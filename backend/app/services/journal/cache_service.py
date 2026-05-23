"""Persistent cache lookups for the deterministic pipeline stages.

We round Places lookup coordinates to 4 decimal places (~11m precision) so
different photos near the same spot share one Places result. CLIP cache is
keyed by (image_id, vocab_version) — bumping the vocab implicitly invalidates
old entries without needing a purge.

Every wrapper here is best-effort: a DB hiccup in the cache layer must NOT
take down the underlying call. If reading or writing the cache fails, we just
log and proceed as if there was no cache.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.cache import COORD_ROUND_DECIMALS, ClipCacheEntry, PlacesCacheEntry

logger = logging.getLogger(__name__)


def _round_coord(value: float) -> Decimal:
    """4 decimal places, half-even rounding (matches DB Numeric(9,4))."""
    return Decimal(str(value)).quantize(Decimal("0.0001"))


# ---------- CLIP cache ----------

def get_cached_clip(
    db: Session, image_id: int, vocab_version: str,
) -> tuple[str | None, list[str] | None] | None:
    """Return (subject, atmosphere) on hit, None on miss."""
    try:
        row = db.get(ClipCacheEntry, (image_id, vocab_version))
    except Exception:
        logger.exception("clip cache read failed for image %d", image_id)
        return None
    if row is None:
        return None
    return row.clip_subject, list(row.clip_atmosphere or [])


def set_cached_clip(
    db: Session,
    image_id: int,
    vocab_version: str,
    subject: str | None,
    atmosphere: list[str] | None,
) -> None:
    try:
        existing = db.get(ClipCacheEntry, (image_id, vocab_version))
        if existing is not None:
            existing.clip_subject = subject
            existing.clip_atmosphere = atmosphere
        else:
            db.add(
                ClipCacheEntry(
                    image_id=image_id,
                    vocab_version=vocab_version,
                    clip_subject=subject,
                    clip_atmosphere=atmosphere,
                )
            )
        db.commit()
    except Exception:
        logger.exception("clip cache write failed for image %d", image_id)
        db.rollback()


# ---------- Places cache ----------

def get_cached_places(
    db: Session, latitude: float, longitude: float,
) -> dict[str, Any] | None:
    lat = _round_coord(latitude)
    lng = _round_coord(longitude)
    try:
        row = db.get(PlacesCacheEntry, (lat, lng))
    except Exception:
        logger.exception("places cache read failed for (%s, %s)", lat, lng)
        return None
    if row is None or row.payload is None:
        return None
    return dict(row.payload)


def set_cached_places(
    db: Session, latitude: float, longitude: float, payload: dict[str, Any],
) -> None:
    lat = _round_coord(latitude)
    lng = _round_coord(longitude)
    try:
        existing = db.get(PlacesCacheEntry, (lat, lng))
        if existing is not None:
            existing.payload = payload
        else:
            db.add(PlacesCacheEntry(rounded_lat=lat, rounded_lng=lng, payload=payload))
        db.commit()
    except Exception:
        logger.exception("places cache write failed for (%s, %s)", lat, lng)
        db.rollback()
