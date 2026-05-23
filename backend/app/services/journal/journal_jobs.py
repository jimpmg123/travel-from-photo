"""Background task entry point for asynchronous Journal generation.

Pipeline per image (in captured_at order):
  1. Idempotency — if a JournalEntry already exists for (journal_id, image_id),
     silently skip; the previous run already persisted it.
  2. Eligibility — image must have GPS + captured_at; else NO_METADATA.
  3. Places API — fill country/city/address/place_name. On failure record
     PLACES_API_TIMEOUT, on empty result PLACES_NO_RESULT.
  4. CLIP — fill clip_subject + clip_atmosphere. Failure is NOT a skip;
     leave fields null (informational only).
  5. GPT-4.1-mini Vision (1 retry) — fill 8 categorical features + detail_note
     + journal_text. Permanent failure -> GPT_GENERATION_FAILED skip.
  6. Persist JournalEntry with provenance.

At end: compute status from (entries_created, total_requested, skipped).
"""
from __future__ import annotations

import logging
import time
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
    SKIP_REASON_GPT_GENERATION_FAILED,
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
    classify_atmosphere,
    classify_subject,
)
from app.services.journal.gpt_vision_service import analyze_journal_photo
from app.services.shared.places_service import enrich_coordinates_with_place_context

logger = logging.getLogger(__name__)

GPT_RETRY_DELAY_SECONDS = 1.0  # one short retry per spec ("after retry")


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
    """Returns (place_context, skip_reason, from_cache).
    skip_reason is None on success; from_cache flags whether the result came
    from the persistent cache (vs. a fresh Places API call)."""
    cached = get_cached_places(db, float(image.latitude), float(image.longitude))
    if cached is not None:
        return cached, None, True

    try:
        context = enrich_coordinates_with_place_context(
            float(image.latitude), float(image.longitude), language_code="en",
        )
    except Exception:
        logger.exception("places enrichment timed out for image %d", image.id)
        return None, SKIP_REASON_PLACES_API_TIMEOUT, False

    # Empty/garbage geocode (e.g. coords over ocean) — record as no result and
    # don't cache it (a future retry with corrected coords shouldn't be poisoned).
    if not context.get("city") and not context.get("country"):
        return None, SKIP_REASON_PLACES_NO_RESULT, False

    set_cached_places(db, float(image.latitude), float(image.longitude), context)
    return context, None, False


def _try_clip(
    db: Session, image_id: int, image_path: str | None,
) -> tuple[str | None, list[str] | None, bool]:
    """Returns (subject, atmosphere, from_cache). Failure is NOT a skip per
    spec — entry persists with empty CLIP fields if the model errors out."""
    if not image_path:
        return None, None, False

    cached = get_cached_clip(db, image_id, CLIP_VOCAB_VERSION)
    if cached is not None:
        subject, atmosphere = cached
        return subject, atmosphere, True

    try:
        subject_label, _ = classify_subject(image_path)
        atmosphere = classify_atmosphere(image_path)
    except Exception:
        logger.exception("CLIP tagging failed for %s", image_path)
        return None, None, False

    set_cached_clip(db, image_id, CLIP_VOCAB_VERSION, subject_label, atmosphere)
    return subject_label, atmosphere, False


def _try_gpt(
    *,
    image_path: str | None,
    place_context: dict[str, Any],
    captured_at: datetime | None,
) -> dict[str, Any] | None:
    """One attempt + one short retry. Returns None if both fail — caller will
    record GPT_GENERATION_FAILED and skip the entry."""
    if not image_path:
        return None

    place_name = (place_context.get("top_poi") or {}).get("name")

    for attempt in (1, 2):
        try:
            return analyze_journal_photo(
                image_path,
                country=place_context.get("country"),
                city=place_context.get("city"),
                place_name=place_name,
                captured_at=captured_at,
            )
        except Exception:
            logger.exception(
                "GPT vision attempt %d failed for %s", attempt, image_path,
            )
            if attempt == 1:
                time.sleep(GPT_RETRY_DELAY_SECONDS)

    return None


def _build_entry(
    *,
    journal_id: int,
    image: ImageMetadata,
    captured_at: datetime | None,
    place_context: dict[str, Any],
    clip_subject: str | None,
    clip_atmosphere: list[str] | None,
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
        clip_subject=clip_subject,
        clip_atmosphere=clip_atmosphere,
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
    """status semantics per spec:
       done            = no images skipped
       partial_success = at least one entry created AND at least one skipped
       failed          = zero entries created."""
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
    # entry_order starts after whatever was persisted on a prior partial run.
    next_order = len(persisted_already)

    for image, captured_at in annotated:
        # Idempotency: a prior run already created this entry.
        if image.id in persisted_already:
            continue

        # NO_METADATA — missing GPS / captured_at.
        if image.latitude is None or image.longitude is None or captured_at is None:
            skipped.append({"image_id": image.id, "reason": SKIP_REASON_NO_METADATA})
            continue

        place_context, places_skip, places_cached = _try_places(db, image)
        if place_context is None:
            skipped.append({"image_id": image.id, "reason": places_skip})
            continue

        clip_subject, clip_atmosphere, clip_cached = _try_clip(
            db, image.id, image.absolute_path,
        )

        gpt_result = _try_gpt(
            image_path=image.absolute_path,
            place_context=place_context,
            captured_at=captured_at,
        )
        if gpt_result is None:
            skipped.append({"image_id": image.id, "reason": SKIP_REASON_GPT_GENERATION_FAILED})
            continue

        # 'cache' provenance applies only when BOTH deterministic stages came
        # from cache. GPT is never cached, so a fully fresh GPT call still
        # leaves the rest of the entry's data "cached-origin".
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
            clip_subject=clip_subject,
            clip_atmosphere=clip_atmosphere,
            gpt_result=gpt_result,
            entry_order=next_order,
            generated_by=generated_by,
        )
        db.add(entry)
        entries_created += 1
        next_order += 1

    db.commit()

    # On retry runs entries_created reflects ONLY the new entries; previously
    # persisted ones don't bump it. For the final status we care about whether
    # the journal as a whole now has any entries, so include the existing set.
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
