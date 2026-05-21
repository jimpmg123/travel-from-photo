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
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class UploadedImage(Base):
    __tablename__ = "uploaded_images"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # Nullable until the search/upload routes are auth-gated; tighten to NOT NULL then.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    search_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("search_sessions.id"), nullable=True, index=True
    )

    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    image_format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    has_gps: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    metadata_case: Mapped[str] = mapped_column(String(20), nullable=False)
    raw_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    exif: Mapped["ImageExifMetadata | None"] = relationship(
        back_populates="image", uselist=False, cascade="all, delete-orphan"
    )


class ImageExifMetadata(Base):
    __tablename__ = "image_exif_metadata"

    image_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("uploaded_images.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Raw EXIF datetime string as extracted (e.g. "2026:05:20 19:00:00").
    # Kept as text to avoid lossy parsing here; consumers parse as needed.
    captured_at: Mapped[str | None] = mapped_column(String(100), nullable=True)

    camera_make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    camera_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lens_model: Mapped[str | None] = mapped_column(String(150), nullable=True)

    gps_latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    gps_longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)

    has_exif_datetime: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    has_exif_gps: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    image: Mapped["UploadedImage"] = relationship(back_populates="exif")
