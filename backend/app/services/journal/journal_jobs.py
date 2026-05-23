"""Background task entry point for asynchronous Journal generation.

Pipeline per image (in captured_at order):
  1. Eligibility — image must have GPS + captured_at; skip otherwise.
  2. Places API — fill country / city / address / place_name.
  3. CLIP — fill clip_subject + clip_atmosphere (statistics-only backup).
  4. GPT-4.1-mini Vision — fill the 8 categorical features + detail_note +
     journal_text. Location is passed in so GPT does NOT re-identify it.
  5. Persist a JournalEntry row with provenance (generated_by, model_version,
     vocab_version, generated_at).

Step 3c scope: orchestration + persistence. Idempotency (skip rows that already
exist), graceful degradation (skipped[] + partial_success), and caching land in
Steps 4 and 5.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.image_metadata import ImageMetadata
from app.models.journal import (
    ENTRY_GENERATED_BY_CLIP_GPT,
    JOURNAL_STATUS_DONE,
    JOURNAL_STATUS_FAILED,
    JOURNAL_STATUS_PROCESSING,
    Journal,
    JournalEntry,
)
from app.services.journal.clip_journal_service import (
    CLIP_VOCAB_VERSION,
    classify_atmosphere,
    classify_subject,
)
from app.services.journal.gpt_vision_service import analyze_journal_photo
from app.services.shared.places_service import enrich_coordinates_with_place_context

logger = logging.getLogger(__name__)


# ImageMetadata stores captured_at as a raw EXIF string. Parse into a real
# timestamp for JournalEntry.captured_at; return None if absent/unparseable.
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


# Order processable images by captured_at ascending so entry_order matches the
# trip timeline. Images missing captured_at fall to the back.
def _sort_for_timeline(
    images: list[ImageMetadata],
) -> list[tuple[ImageMetadata, datetime | None]]:
    annotated = [(image, _parse_captured_at(image.captured_at)) for image in images]
    annotated.sort(key=lambda pair: (pair[1] is None, pair[1] or datetime.max))
    return annotated


def _fetch_place_context(image: ImageMetadata) -> dict[str, Any]:
    """Wrap the Places call so an outage on one image doesn't kill the loop
    — the per-image try/except in the orchestrator decides what to do with the
    failure. Step 4 will tag this with PLACES_API_TIMEOUT / PLACES_NO_RESULT."""
    return enrich_coordinates_with_place_context(
        float(image.latitude),
        float(image.longitude),
        language_code="en",
    )


def _build_entry(
    *,
    journal_id: int,
    image: ImageMetadata,
    captured_at: datetime | None,
    place_context: dict[str, Any],
    clip_subject: str | None,
    clip_atmosphere: list[str] | None,
    gpt_result: dict[str, Any] | None,
    entry_order: int,
) -> JournalEntry:
    top_poi = place_context.get("top_poi") or {}
    gpt_result = gpt_result or {}

    return JournalEntry(
        journal_id=journal_id,
        image_id=image.id,
        # Places
        place_name=top_poi.get("name"),
        country=place_context.get("country"),
        city=place_context.get("city"),
        address=_first_address_part(place_context.get("formatted_address")),
        latitude=image.latitude,
        longitude=image.longitude,
        captured_at=captured_at,
        # CLIP
        clip_subject=clip_subject,
        clip_atmosphere=clip_atmosphere,
        # GPT
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
        # Order + provenance
        entry_order=entry_order,
        generated_by=ENTRY_GENERATED_BY_CLIP_GPT,
        model_version=gpt_result.get("model_version"),
        vocab_version=CLIP_VOCAB_VERSION,
    )


def _process_one_image(
    *,
    db: Session,
    journal_id: int,
    image: ImageMetadata,
    captured_at: datetime | None,
    entry_order: int,
) -> JournalEntry | None:
    """Run the per-image pipeline. CLIP / GPT failures degrade the entry but
    do not abort it — we still record location + whatever survived. Returns
    None only if the image cannot produce any meaningful entry."""
    try:
        place_context = _fetch_place_context(image)
    except Exception:
        logger.exception(
            "places enrichment failed for image %d (journal %d)", image.id, journal_id,
        )
        return None  # Step 4: tag as PLACES_API_TIMEOUT / PLACES_NO_RESULT

    image_path = image.absolute_path

    clip_subject_value: str | None = None
    clip_atmosphere_value: list[str] | None = None
    if image_path:
        try:
            subject_label, _ = classify_subject(image_path)
            clip_subject_value = subject_label
            clip_atmosphere_value = classify_atmosphere(image_path)
        except Exception:
            # Step 4 note: CLIP failure should NOT be a skip reason. We leave
            # the slot empty as if below threshold, equivalent to 'uncategorized'.
            logger.exception(
                "CLIP tagging failed for image %d (journal %d)", image.id, journal_id,
            )

    gpt_result: dict[str, Any] | None = None
    if image_path:
        try:
            gpt_result = analyze_journal_photo(
                image_path,
                country=place_context.get("country"),
                city=place_context.get("city"),
                place_name=(place_context.get("top_poi") or {}).get("name"),
                captured_at=captured_at,
            )
        except Exception:
            logger.exception(
                "GPT vision failed for image %d (journal %d)", image.id, journal_id,
            )
            # Step 4 will record GPT_GENERATION_FAILED on the skipped list.

    return _build_entry(
        journal_id=journal_id,
        image=image,
        captured_at=captured_at,
        place_context=place_context,
        clip_subject=clip_subject_value,
        clip_atmosphere=clip_atmosphere_value,
        gpt_result=gpt_result,
        entry_order=entry_order,
    )


def _run_pipeline(db: Session, journal: Journal, image_ids: list[int]) -> None:
    images = (
        db.query(ImageMetadata)
        .filter(ImageMetadata.id.in_(image_ids))
        .all()
    )
    annotated = _sort_for_timeline(images)

    next_order = 0
    for image, captured_at in annotated:
        if image.latitude is None or image.longitude is None or captured_at is None:
            # NO_METADATA — Step 4 will record this in skipped[].
            continue

        entry = _process_one_image(
            db=db,
            journal_id=journal.id,
            image=image,
            captured_at=captured_at,
            entry_order=next_order,
        )
        if entry is None:
            continue

        db.add(entry)
        next_order += 1

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

        journal.status = JOURNAL_STATUS_DONE
        db.commit()

    except Exception as exc:  # noqa: BLE001 — capture all to record on Journal
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
