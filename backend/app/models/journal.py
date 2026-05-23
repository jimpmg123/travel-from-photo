from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


# Standardized reason codes for images that get skipped during generation.
# Surfaced in Journal.skipped[].reason and in the GET /jobs/{id} response.
SKIP_REASON_NO_METADATA = "NO_METADATA"
SKIP_REASON_PLACES_API_TIMEOUT = "PLACES_API_TIMEOUT"
SKIP_REASON_PLACES_NO_RESULT = "PLACES_NO_RESULT"
SKIP_REASON_GPT_GENERATION_FAILED = "GPT_GENERATION_FAILED"
# CLIP_BELOW_THRESHOLD is informational only — entries with weak CLIP are kept
# as 'uncategorized', not skipped. Listed here so callers know the enum.
SKIP_REASON_CLIP_BELOW_THRESHOLD = "CLIP_BELOW_THRESHOLD"


# Status values for a Journal generation job.
JOURNAL_STATUS_PENDING = "pending"
JOURNAL_STATUS_PROCESSING = "processing"
JOURNAL_STATUS_DONE = "done"
JOURNAL_STATUS_PARTIAL_SUCCESS = "partial_success"
JOURNAL_STATUS_FAILED = "failed"

JOURNAL_STATUS_VALUES = (
    JOURNAL_STATUS_PENDING,
    JOURNAL_STATUS_PROCESSING,
    JOURNAL_STATUS_DONE,
    JOURNAL_STATUS_PARTIAL_SUCCESS,
    JOURNAL_STATUS_FAILED,
)

JOURNAL_ACTIVE_STATUSES = (JOURNAL_STATUS_PENDING, JOURNAL_STATUS_PROCESSING)

# Visibility values for a Journal.
JOURNAL_VISIBILITY_PRIVATE = "private"
JOURNAL_VISIBILITY_PUBLIC = "public"

# Provenance values for a JournalEntry.
ENTRY_GENERATED_BY_CLIP_GPT = "clip_gpt"
ENTRY_GENERATED_BY_MANUAL = "manual"
ENTRY_GENERATED_BY_CACHE = "cache"


class Journal(Base):
    __tablename__ = "journals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JOURNAL_VISIBILITY_PRIVATE,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=JOURNAL_STATUS_PENDING,
        index=True,
    )
    error_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # List of {image_id: int, reason: SKIP_REASON_*} entries — populated by the
    # background task when individual images fail to generate.
    skipped: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    entries: Mapped[list["JournalEntry"]] = relationship(
        back_populates="journal",
        cascade="all, delete-orphan",
        order_by="JournalEntry.entry_order",
    )


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("journal_id", "image_id", name="uq_journal_entry_journal_image"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    journal_id: Mapped[int] = mapped_column(
        ForeignKey("journals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_id: Mapped[int] = mapped_column(
        ForeignKey("image_metadata.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Location (filled from Places API)
    place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)

    captured_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # CLIP categorical (statistics-only backup, see clip_journal_service)
    clip_subject: Mapped[str | None] = mapped_column(String(50), nullable=True)
    clip_atmosphere: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # GPT Vision categorical (rich features for pattern discovery)
    gpt_shooting_style: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_subject_focus: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_time_of_day: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_atmosphere: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_weather_light: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_composition_habit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_color_mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_cultural_layer: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gpt_detail_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # GPT narrative text (replaces 'description')
    journal_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    entry_order: Mapped[int] = mapped_column(Integer, nullable=False)

    # Provenance (Feature 2)
    generated_by: Mapped[str] = mapped_column(String(20), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vocab_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    journal: Mapped["Journal"] = relationship(back_populates="entries")
