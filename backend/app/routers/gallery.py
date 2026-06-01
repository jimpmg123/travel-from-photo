from collections import defaultdict
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.image_metadata import ImageMetadata
from app.models.saved_place import SavedPlace
from app.models.social import UserSetting
from app.models.user import User
from app.services.shared.exif_service import extract_image_metadata

router = APIRouter(tags=["gallery"])

UPLOAD_DIR = Path("uploads") / "gallery"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class SavedPlaceOut(BaseModel):
    id: int
    collection_name: str
    place_name: str
    formatted_address: str | None
    country: str | None
    city: str | None
    latitude: float | None
    longitude: float | None
    image_url: str | None
    image_metadata_id: int | None
    has_gps: bool
    privacy: str = "private"
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionOut(BaseModel):
    name: str
    saves: list[SavedPlaceOut]


class CollectionsResponse(BaseModel):
    collections: list[CollectionOut]


class UpdateSavedPlaceIn(BaseModel):
    place_name: str | None = None
    collection_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    formatted_address: str | None = None


class RenameCollectionIn(BaseModel):
    old_name: str
    new_name: str


def _to_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _serialize(place: SavedPlace) -> SavedPlaceOut:
    lat = _to_float(place.latitude)
    lng = _to_float(place.longitude)
    return SavedPlaceOut(
        id=place.id,
        collection_name=place.collection_name,
        place_name=place.place_name,
        formatted_address=place.formatted_address,
        country=place.country,
        city=place.city,
        latitude=lat,
        longitude=lng,
        image_url=place.image_url,
        image_metadata_id=place.image_metadata_id,
        has_gps=lat is not None and lng is not None,
        privacy=getattr(place, "privacy", "private"),
        created_at=place.created_at,
    )


def _create_image_metadata_from_saved_file(
    db: Session,
    *,
    user_id: int,
    target_path: Path,
    fallback_filename: str,
    fallback_lat: float | None,
    fallback_lng: float | None,
) -> int | None:
    """Parse EXIF from the just-saved gallery file and create an
    image_metadata row owned by the user. Returns the new row's id, or
    None if extraction failed (saved_place is still usable, but journal
    generation can't use it).
    """
    try:
        meta = extract_image_metadata(target_path)
    except Exception:
        return None

    image_info = meta.get("image") or {}
    camera_info = meta.get("camera") or {}
    gps_info = meta.get("gps") or {}

    lat = gps_info.get("latitude") if gps_info else fallback_lat
    lng = gps_info.get("longitude") if gps_info else fallback_lng
    has_gps = lat is not None and lng is not None

    row = ImageMetadata(
        user_id=user_id,
        file_name=meta.get("file_name") or fallback_filename or target_path.name,
        absolute_path=str(target_path.resolve()),
        file_size_bytes=int(meta.get("file_size_bytes") or target_path.stat().st_size),
        image_format=image_info.get("format"),
        image_mode=image_info.get("mode"),
        width=image_info.get("width"),
        height=image_info.get("height"),
        captured_at=meta.get("captured_at"),
        camera_make=camera_info.get("make"),
        camera_model=camera_info.get("model"),
        lens_model=camera_info.get("lens_model"),
        latitude=lat,
        longitude=lng,
        has_gps=bool(has_gps),
        metadata_case="gps_present" if has_gps else "gps_missing",
        raw_metadata=meta,
    )
    db.add(row)
    db.flush()
    return row.id


@router.get("/gallery/collections", response_model=CollectionsResponse)
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(SavedPlace)
        .filter(SavedPlace.user_id == current_user.id)
        .order_by(SavedPlace.created_at.desc())
        .all()
    )
    grouped: dict[str, list[SavedPlaceOut]] = defaultdict(list)
    for row in rows:
        grouped[row.collection_name].append(_serialize(row))
    collections = [CollectionOut(name=name, saves=saves) for name, saves in grouped.items()]
    collections.sort(key=lambda c: c.name.lower())
    return CollectionsResponse(collections=collections)


@router.post("/gallery/saves", response_model=SavedPlaceOut)
async def create_saved_place(
    image: UploadFile = File(...),
    place_name: str = Form(...),
    collection_name: str = Form("My Gallery"),
    formatted_address: str | None = Form(None),
    country: str | None = Form(None),
    city: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
    MAX_BYTES = 30 * 1024 * 1024

    suffix = Path(image.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload JPEG, PNG, or WebP.")

    contents = await image.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 30 MB.")

    safe_suffix = suffix if suffix != ".jpeg" else ".jpg"
    saved_name = f"{uuid4().hex}{safe_suffix}"
    target_path = UPLOAD_DIR / saved_name

    with open(target_path, "wb") as buf:
        buf.write(contents)

    image_metadata_id = _create_image_metadata_from_saved_file(
        db,
        user_id=current_user.id,
        target_path=target_path,
        fallback_filename=image.filename or saved_name,
        fallback_lat=latitude,
        fallback_lng=longitude,
    )

    user_setting = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    default_privacy = user_setting.default_privacy if user_setting else "private"

    row = SavedPlace(
        user_id=current_user.id,
        collection_name=(collection_name or "My Gallery").strip() or "My Gallery",
        place_name=place_name.strip()[:255] or "Unnamed place",
        formatted_address=formatted_address,
        country=country,
        city=city,
        latitude=latitude,
        longitude=longitude,
        image_filename=image.filename,
        image_url=f"/uploads/gallery/{saved_name}",
        image_metadata_id=image_metadata_id,
        privacy=default_privacy,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.patch("/gallery/saves/{save_id}", response_model=SavedPlaceOut)
def update_saved_place(
    save_id: int,
    body: UpdateSavedPlaceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(SavedPlace)
        .filter(SavedPlace.id == save_id, SavedPlace.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Saved place not found.")

    if body.place_name is not None:
        cleaned = body.place_name.strip()[:255]
        if cleaned:
            row.place_name = cleaned
    if body.collection_name is not None:
        cleaned = body.collection_name.strip()[:120]
        if cleaned:
            row.collection_name = cleaned
    if body.latitude is not None:
        row.latitude = body.latitude
    if body.longitude is not None:
        row.longitude = body.longitude
    if body.formatted_address is not None:
        row.formatted_address = body.formatted_address[:500] if body.formatted_address else None

    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/gallery/saves/{save_id}")
def delete_saved_place(
    save_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(SavedPlace)
        .filter(SavedPlace.id == save_id, SavedPlace.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Saved place not found.")
    db.delete(row)
    db.commit()
    return {"deleted_id": save_id}


@router.delete("/gallery/collections/{collection_name}")
def delete_collection(
    collection_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = (
        db.query(SavedPlace)
        .filter(
            SavedPlace.user_id == current_user.id,
            SavedPlace.collection_name == collection_name,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted_count": deleted, "collection_name": collection_name}


@router.post("/gallery/collections/rename")
def rename_collection(
    body: RenameCollectionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_name = (body.new_name or "").strip()[:120]
    if not new_name:
        raise HTTPException(status_code=400, detail="New collection name is required.")
    updated = (
        db.query(SavedPlace)
        .filter(
            SavedPlace.user_id == current_user.id,
            SavedPlace.collection_name == body.old_name,
        )
        .update({SavedPlace.collection_name: new_name}, synchronize_session=False)
    )
    db.commit()
    return {"renamed_count": updated, "new_name": new_name}
