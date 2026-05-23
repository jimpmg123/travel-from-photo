"""Background task entry points for asynchronous Journal generation.

Step 3a scope:
  - Load ImageMetadata rows by id
  - For each image with GPS + captured_at, call Places to fill location fields
  - Persist a JournalEntry row per processed image
  - Walk the Journal status through pending -> processing -> done

CLIP tagging (Step 3b) and GPT description (Step 3c) are out of scope here —
the corresponding JournalEntry fields stay null for now. Graceful degradation
(per-image error tracking, partial_success status) lands in Step 4.
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
from app.services.shared.places_service import enrich_coordinates_with_place_context

logger = logging.getLogger(__name__)


# Parse the string captured_at stored on ImageMetadata into a datetime, or None
# if missing/unparseable. ImageMetadata stores raw EXIF strings; JournalEntry
# wants a real timestamp.
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
# trip timeline. Images missing a captured_at fall to the back.
def _sort_for_timeline(images: list[ImageMetadata]) -> list[tuple[ImageMetadata, datetime | None]]:
    annotated = [(image, _parse_captured_at(image.captured_at)) for image in images]
    annotated.sort(
        key=lambda pair: (pair[1] is None, pair[1] or datetime.max),
    )
    return annotated


def _build_entry_from_places(
    *,
    journal_id: int,
    image: ImageMetadata,
    captured_at: datetime | None,
    place_context: dict[str, Any],
    entry_order: int,
) -> JournalEntry:
    """Step 3-prep: only place fields are populated. CLIP/GPT fields are filled
    in Step 3a/3b/3c when the corresponding services are wired in."""
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
        # CLIP fields — Step 3a
        clip_subject=None,
        clip_atmosphere=None,
        # GPT fields — Step 3b
        gpt_shooting_style=None,
        gpt_subject_focus=None,
        gpt_time_of_day=None,
        gpt_atmosphere=None,
        gpt_weather_light=None,
        gpt_composition_habit=None,
        gpt_color_mood=None,
        gpt_cultural_layer=None,
        gpt_detail_note=None,
        journal_text=None,
        entry_order=entry_order,
        generated_by=ENTRY_GENERATED_BY_CLIP_GPT,
        model_version=None,
        vocab_version=None,
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
            # Step 4 will record the reason; for now we silently skip.
            continue

        try:
            place_context = enrich_coordinates_with_place_context(
                float(image.latitude),
                float(image.longitude),
                language_code="en",
            )
        except Exception:
            logger.exception(
                "places enrichment failed for image %d (journal %d)",
                image.id, journal.id,
            )
            continue

        entry = _build_entry_from_places(
            journal_id=journal.id,
            image=image,
            captured_at=captured_at,
            place_context=place_context,
            entry_order=next_order,
        )
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
