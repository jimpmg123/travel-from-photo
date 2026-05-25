"""Background task entry point for asynchronous Journal generation (v3).

Per image:
  0. Idempotency — if a JournalEntry already exists for (journal_id, image_id),
     silently skip; the previous run already persisted it.
  1. Eligibility — image must have GPS + captured_at; else NO_METADATA skip.
  2. Places API (cache-first) — fill country/city/address/place_name.
     On failure record PLACES_API_TIMEOUT / PLACES_NO_RESULT and skip.
  3. **Parallel** GPT Vision + CLIP (3 axis: subject/atmosphere/activity).
     CLIP runs on a worker thread; GPT runs on another. They share no data,
     and the per-call safety belts mean either failing falls back to defaults
     instead of aborting the entry.
  4. Persist JournalEntry with whatever survived. GPT fail uses fallback
     text (entry never blank). CLIP fail leaves the axis fields empty.

At end: compute final status from (entries_created, total_requested, skipped).
"""
from __future__ import annotations

import concurrent.futures
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.image_metadata import ImageMetadata
from app.models.journal import (
    ENTRY_GENERATED_BY_CACHE,
    ENTRY_GENERATED_BY_CLIP_GPT,
    JOURNAL_STATUS_DONE,
    JOURNAL_STATUS_FAILED,
    JOURNAL_STATUS_PARTIAL_SUCCESS,
    JOURNAL_STATUS_PROCESSING,
    SKIP_REASON_NO_METADATA,
    SKIP_REASON_PLACES_API_TIMEOUT,
    SKIP_REASON_PLACES_NO_RESULT,
    Journal,
    JournalEntry,
)
from app.repositories.journal_repository import get_persisted_image_ids
from app.services.journal.cache_service import (
    get_cached_clip,
    get_cached_places,
    set_cached_clip,
    set_cached_places,
)
from app.services.journal.clip_journal_service import (
    CLIP_VOCAB_VERSION,
    classify_activity,
    classify_atmosphere,
    classify_subject,
)
from app.services.journal.gpt_vision_service import analyze_journal_photo
from app.services.shared.places_service import enrich_coordinates_with_place_context

logger = logging.getLogger(__name__)

# Hard cap on Places API per image (cascading-failure safety belt).
PLACES_REQUEST_TIMEOUT_SECONDS = 15.0


# ---------- helpers ----------

def _parse_captured_at(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _first_address_part(formatted_address: str | None) -> str | None:
    if not formatted_address:
        return None
    head = formatted_address.split(",")[0].strip()
    return head or None


def _sort_for_timeline(
    images: list[ImageMetadata],
) -> list[tuple[ImageMetadata, datetime | None]]:
    annotated = [(image, _parse_captured_at(image.captured_at)) for image in images]
    annotated.sort(key=lambda pair: (pair[1] is None, pair[1] or datetime.max))
    return annotated


# ---------- per-image stages ----------

def _try_places(
    db: Session, image: ImageMetadata,
) -> tuple[dict[str, Any] | None, str | None, bool]:
    """Returns (place_context, skip_reason, from_cache)."""
    cached = get_cached_places(db, float(image.latitude), float(image.longitude))
    if cached is not None:
        return cached, None, True

    # Run the (potentially slow) Places call on a worker thread so we can
    # impose a real wall-clock timeout. Without this, a hung HTTP socket
    # could pin the entire BackgroundTask waiting on a single image.
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(
            enrich_coordinates_with_place_context,
            float(image.latitude), float(image.longitude),
        )
        try:
            context = future.result(timeout=PLACES_REQUEST_TIMEOUT_SECONDS)
        except concurrent.futures.TimeoutError:
            logger.warning("places enrichment timed out for image %d", image.id)
            return None, SKIP_REASON_PLACES_API_TIMEOUT, False
        except Exception:
            logger.exception("places enrichment failed for image %d", image.id)
            return None, SKIP_REASON_PLACES_API_TIMEOUT, False

    # Coords over ocean / invalid yield no city + no country — treat as a
    # "no place" skip rather than persist a blank row.
    if not context.get("city") and not context.get("country"):
        return None, SKIP_REASON_PLACES_NO_RESULT, False

    set_cached_places(db, float(image.latitude), float(image.longitude), context)
    return context, None, False


def _run_clip_three_axis(image_path: str) -> dict[str, Any]:
    """Run all three CLIP axes for one image. Caller wraps in try/except so
    a model crash falls back to empty tag lists (CLIP failure is non-fatal
    per spec — entry persists either way)."""
    return {
        "subject": classify_subject(image_path),
        "atmosphere": classify_atmosphere(image_path),
        "activity": classify_activity(image_path),
    }


def _try_clip(
    db: Session, image_id: int, image_path: str | None,
) -> tuple[dict[str, Any], bool]:
    """Returns (clip_result, from_cache). clip_result always has subject /
    atmosphere / activity keys (empty lists on failure)."""
    empty = {"subject": [], "atmosphere": [], "activity": []}
    if not image_path:
        return empty, False

    cached = get_cached_clip(db, image_id, CLIP_VOCAB_VERSION)
    if cached is not None:
        return cached, True

    try:
        fresh = _run_clip_three_axis(image_path)
    except Exception:
        logger.exception("CLIP tagging failed for %s", image_path)
        return empty, False

    set_cached_clip(db, image_id, CLIP_VOCAB_VERSION, fresh)
    return fresh, False


def _build_entry(
    *,
    journal_id: int,
    image: ImageMetadata,
    captured_at: datetime | None,
    place_context: dict[str, Any],
    clip_result: dict[str, Any],
    gpt_result: dict[str, Any],
    entry_order: int,
    generated_by: str,
) -> JournalEntry:
    top_poi = place_context.get("top_poi") or {}
    return JournalEntry(
        journal_id=journal_id,
        image_id=image.id,
        place_name=top_poi.get("name"),
        country=place_context.get("country"),
        city=place_context.get("city"),
        address=_first_address_part(place_context.get("formatted_address")),
        latitude=image.latitude,
        longitude=image.longitude,
        captured_at=captured_at,
        clip_subject=clip_result.get("subject") or None,
        clip_atmosphere=clip_result.get("atmosphere") or None,
        clip_activity=clip_result.get("activity") or None,
        gpt_shooting_style=gpt_result.get("shooting_style"),
        gpt_subject_focus=gpt_result.get("subject_focus"),
        gpt_time_of_day=gpt_result.get("time_of_day"),
        gpt_atmosphere=gpt_result.get("atmosphere"),
        gpt_weather_light=gpt_result.get("weather_light"),
        gpt_composition_habit=gpt_result.get("composition_habit"),
        gpt_color_mood=gpt_result.get("color_mood"),
        gpt_cultural_layer=gpt_result.get("cultural_layer"),
        gpt_detail_note=gpt_result.get("detail_note"),
        journal_text=gpt_result.get("journal_text"),
        entry_order=entry_order,
        generated_by=generated_by,
        model_version=gpt_result.get("model_version"),
        vocab_version=CLIP_VOCAB_VERSION,
    )


# ---------- orchestration ----------

def _compute_final_status(*, entries_created: int, skipped_count: int) -> str:
    if entries_created == 0:
        return JOURNAL_STATUS_FAILED
    if skipped_count == 0:
        return JOURNAL_STATUS_DONE
    return JOURNAL_STATUS_PARTIAL_SUCCESS


def _run_pipeline(db: Session, journal: Journal, image_ids: list[int]) -> None:
    persisted_already = get_persisted_image_ids(db, journal.id)

    images = (
        db.query(ImageMetadata)
        .filter(ImageMetadata.id.in_(image_ids))
        .all()
    )
    annotated = _sort_for_timeline(images)

    skipped: list[dict[str, Any]] = []
    entries_created = 0
    # entry_order picks up after whatever a prior partial run persisted.
    next_order = len(persisted_already)

    for image, captured_at in annotated:
        if image.id in persisted_already:
            continue

        if image.latitude is None or image.longitude is None or captured_at is None:
            skipped.append({"image_id": image.id, "reason": SKIP_REASON_NO_METADATA})
            continue

        place_context, places_skip, places_cached = _try_places(db, image)
        if place_context is None:
            skipped.append({"image_id": image.id, "reason": places_skip})
            continue

        # Run GPT + CLIP in parallel. GPT is I/O bound (~2-5s on OpenAI),
        # CLIP is CPU bound (~0.5-3s local); overlapping them roughly halves
        # per-image latency. Both have their own safety belts internally so
        # neither future is allowed to throw — they always return a usable
        # value (CLIP returns empty lists, GPT returns the fallback dict).
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            clip_future = executor.submit(_try_clip, db, image.id, image.absolute_path)
            gpt_future = executor.submit(
                analyze_journal_photo,
                image.absolute_path,
                country=place_context.get("country"),
                city=place_context.get("city"),
                place_name=(place_context.get("top_poi") or {}).get("name"),
                captured_at=captured_at,
            )

            try:
                clip_result, clip_cached = clip_future.result()
            except Exception:
                logger.exception("CLIP future raised unexpectedly for image %d", image.id)
                clip_result = {"subject": [], "atmosphere": [], "activity": []}
                clip_cached = False

            try:
                gpt_result = gpt_future.result()
            except FileNotFoundError:
                # Image vanished from disk between Places call and GPT call.
                # Skip this image — there's nothing left to caption.
                logger.warning("image file vanished for %d, skipping", image.id)
                continue
            except Exception:
                # analyze_journal_photo is supposed to swallow API errors and
                # return a fallback. Any leak here is unexpected — degrade safely.
                logger.exception("GPT future raised unexpectedly for image %d", image.id)
                from app.services.journal.gpt_vision_service import _safe_default_payload
                gpt_result = _safe_default_payload(model_label="unknown")

        # 'cache' provenance applies only when BOTH deterministic stages came
        # from cache. GPT is never cached, so even a fully fresh GPT call still
        # leaves the rest of the entry's data "cached-origin" — that's the
        # narrowest honest definition.
        generated_by = (
            ENTRY_GENERATED_BY_CACHE
            if places_cached and clip_cached
            else ENTRY_GENERATED_BY_CLIP_GPT
        )

        entry = _build_entry(
            journal_id=journal.id,
            image=image,
            captured_at=captured_at,
            place_context=place_context,
            clip_result=clip_result,
            gpt_result=gpt_result,
            entry_order=next_order,
            generated_by=generated_by,
        )
        db.add(entry)
        entries_created += 1
        next_order += 1

    db.commit()

    # entries_created counts only NEW entries this run. Include previously
    # persisted ones in the status decision so a retry that finished one
    # leftover image doesn't get marked 'failed' just because this run alone
    # produced 1 entry while skipping N.
    total_persisted = entries_created + len(persisted_already)
    journal.status = _compute_final_status(
        entries_created=total_persisted,
        skipped_count=len(skipped),
    )
    journal.skipped = skipped or None
    db.commit()


def process_journal_job(journal_id: int, image_ids: list[int]) -> None:
    db = SessionLocal()
    try:
        journal = db.get(Journal, journal_id)
        if journal is None:
            logger.warning("process_journal_job: journal %d not found", journal_id)
            return

        journal.status = JOURNAL_STATUS_PROCESSING
        db.commit()

        _run_pipeline(db, journal, image_ids)

    except Exception as exc:  # noqa: BLE001
        logger.exception("process_journal_job: job %d failed", journal_id)
        try:
            db.rollback()
            journal = db.get(Journal, journal_id)
            if journal is not None:
                journal.status = JOURNAL_STATUS_FAILED
                journal.error_reason = str(exc)[:500]
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
