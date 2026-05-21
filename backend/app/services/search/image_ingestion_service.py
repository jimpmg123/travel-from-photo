from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.repositories.image_metadata_repository import create_image_metadata
from app.services.shared.exif_service import extract_image_metadata


def enrich_metadata_case(metadata: dict[str, Any], *, include_path: bool = True) -> dict[str, Any]:
    gps = metadata.get("gps")
    payload = dict(metadata)
    payload["has_gps"] = bool(gps)
    payload["metadata_case"] = "gps_present" if gps else "gps_missing"

    if not include_path:
        payload["absolute_path"] = None

    return payload


def extract_image_metadata_payload(
    image_path: str | Path,
    *,
    include_path: bool = True,
    db: Session | None = None,
    user_id: int | None = None,
    search_session_id: int | None = None,
) -> dict[str, Any]:
    metadata = extract_image_metadata(image_path)
    payload = enrich_metadata_case(metadata, include_path=include_path)

    if db is not None:
        saved_row = create_image_metadata(
            db,
            payload,
            user_id=user_id,
            search_session_id=search_session_id,
        )
        payload["database_id"] = saved_row.id

    return payload


async def ingest_uploaded_file(
    file: UploadFile,
    *,
    db: Session | None = None,
) -> dict[str, Any]:
    suffix = Path(file.filename or "upload.bin").suffix
    temp_path: Path | None = None

    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        payload = extract_image_metadata_payload(
            temp_path,
            include_path=False,
            db=db,
        )
        payload["file_name"] = file.filename or payload["file_name"]

        return payload
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)
