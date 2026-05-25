"""Pipeline-output cache tables.

Spec rule: cache only deterministic outputs. CLIP (same image + same vocab
always gives the same tags) and Places (rounded coordinates resolve to the
same place) are both deterministic. GPT-4.1-mini is NOT — even at temperature=0
it's non-deterministic — so we do not cache it.

ClipCacheEntry: keyed by (image_id, vocab_version) so bumping the vocabulary
invalidates the cache for free without a manual purge.

PlacesCacheEntry: keyed by lat/lng rounded to 4 decimal places (~11m precision).
Different photos near the same spot reuse one Places result.
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

COORD_ROUND_DECIMALS = 4


class ClipCacheEntry(Base):
    __tablename__ = "clip_cache"

    image_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("image_metadata.id", ondelete="CASCADE"),
        primary_key=True,
    )
    vocab_version: Mapped[str] = mapped_column(String(20), primary_key=True)
    # v3: all three axes are multi-label lists
    clip_subject: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    clip_atmosphere: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    clip_activity: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class PlacesCacheEntry(Base):
    __tablename__ = "places_cache"

    rounded_lat: Mapped[float] = mapped_column(Numeric(9, 4), primary_key=True)
    rounded_lng: Mapped[float] = mapped_column(Numeric(9, 4), primary_key=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
