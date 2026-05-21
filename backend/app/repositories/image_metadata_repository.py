from typing import Any

from sqlalchemy.orm import Session

from app.models.uploaded_image import ImageExifMetadata, UploadedImage


def _metadata_case_from_payload(metadata: dict[str, Any]) -> str:
    if metadata.get("metadata_case"):
        return str(metadata["metadata_case"])

    return "gps_present" if metadata.get("gps") else "gps_missing"


def create_image_metadata(
    db: Session,
    metadata: dict[str, Any],
    *,
    user_id: int | None = None,
    search_session_id: int | None = None,
) -> UploadedImage:
    """Persist one uploaded image as two rows: the image itself
    (uploaded_images) and its EXIF (image_exif_metadata). Returns the
    UploadedImage so callers can keep using row.id."""

    image_info = metadata.get("image") or {}
    camera_info = metadata.get("camera") or {}
    gps_info = metadata.get("gps") or {}
    captured_at = metadata.get("captured_at")

    image = UploadedImage(
        user_id=user_id,
        search_session_id=search_session_id,
        original_file_name=metadata["file_name"],
        stored_file_path=metadata.get("absolute_path"),
        file_size_bytes=metadata["file_size_bytes"],
        image_format=image_info.get("format"),
        image_mode=image_info.get("mode"),
        width=image_info.get("width"),
        height=image_info.get("height"),
        has_gps=bool(metadata.get("gps")),
        metadata_case=_metadata_case_from_payload(metadata),
        raw_metadata=metadata,
    )
    db.add(image)
    db.flush()  # assigns image.id without ending the transaction

    exif = ImageExifMetadata(
        image_id=image.id,
        captured_at=captured_at,
        camera_make=camera_info.get("make"),
        camera_model=camera_info.get("model"),
        lens_model=camera_info.get("lens_model"),
        gps_latitude=gps_info.get("latitude"),
        gps_longitude=gps_info.get("longitude"),
        has_exif_datetime=bool(captured_at),
        has_exif_gps=bool(metadata.get("gps")),
    )
    db.add(exif)

    db.commit()
    db.refresh(image)
    return image
