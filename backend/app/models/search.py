from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class SearchSession(Base):
    """One search attempt. Holds the user's hints and can group same-trip photos."""

    __tablename__ = "search_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    hint_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hint_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hint_region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_hint_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ImageAnalysisRun(Base):
    """One analysis attempt for one image. Kept per-attempt so re-analysis
    (the gallery "Verify Location" feature) preserves history. Holds the
    final verdict and the chosen resolved location."""

    __tablename__ = "image_analysis_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    image_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("uploaded_images.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    search_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("search_sessions.id"), nullable=True, index=True
    )

    # 0 on first try; incremented when the user re-runs with extra hints.
    hint_round: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    # confident | likely | suggestions | failed
    verdict: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolved_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # metadata_gps | inferred_gps | none
    coordinate_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="none"
    )

    has_resolved_location: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    resolved_place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resolved_formatted_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolved_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolved_latitude: Mapped[float | None] = mapped_column(
        Numeric(10, 7), nullable=True
    )
    resolved_longitude: Mapped[float | None] = mapped_column(
        Numeric(10, 7), nullable=True
    )

    clip_gate: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    clip_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    signals: Mapped[list["AnalysisSignal"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    candidates: Mapped[list["LocationCandidate"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class AnalysisSignal(Base):
    """One answer from one helper (an API/model). Many rows per run — this is
    what makes signal fusion possible: each source's raw response + a score."""

    __tablename__ = "analysis_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("image_analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # exif_gps | clip_gate | clip_scene | vision_landmark | vision_label |
    # vision_ocr | vision_web | vision_logo | gpt4o_vision | claude_vision | ...
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)

    raw_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    parsed_place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parsed_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parsed_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parsed_latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    parsed_longitude: Mapped[float | None] = mapped_column(
        Numeric(10, 7), nullable=True
    )

    signal_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    run: Mapped["ImageAnalysisRun"] = relationship(back_populates="signals")


class LocationCandidate(Base):
    """A possible place built by fusing signals. Many rows per run, ranked —
    feeds the result UI's #1 match + alternates."""

    __tablename__ = "location_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("image_analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    formatted_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    google_place_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    aggregated_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    # e.g. [{"source": "gpt4o_vision", "weight": 0.8}, ...]
    contributing_sources: Mapped[list | None] = mapped_column(JSON, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_selected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    run: Mapped["ImageAnalysisRun"] = relationship(back_populates="candidates")


class SearchSelection(Base):
    """The final location the user committed for an image — either a chosen
    AI candidate or a manual entry. This is what the gallery saves."""

    __tablename__ = "search_selections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    image_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("uploaded_images.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("image_analysis_runs.id"), nullable=True
    )
    candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("location_candidates.id"), nullable=True
    )

    # ai_candidate | manual
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)

    place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
