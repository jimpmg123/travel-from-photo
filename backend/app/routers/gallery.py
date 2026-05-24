"""Gallery endpoints — file upload + list.

The previous mock-list approach has been removed; both endpoints now operate
against a real on-disk uploads directory only. Once the Search team wires the
upload pipeline into the image_metadata table, GET /gallery should switch to
returning rows from there (currently it returns an empty list because nothing
is persisted yet).
"""
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(tags=["gallery"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class GalleryItem(BaseModel):
    id: str
    fileName: str
    fileUrl: str
    uploadedAt: datetime
    hasGPS: bool
    city: str | None = None
    country: str | None = None


class GalleryListResponse(BaseModel):
    items: list[GalleryItem]


class DeleteGalleryResponse(BaseModel):
    message: str
    deletedId: str


@router.get("/gallery", response_model=GalleryListResponse)
def get_gallery():
    # TODO Search team: return image_metadata rows for the current user once
    # the upload pipeline persists them.
    return {"items": []}


@router.post("/gallery/upload")
async def upload_gallery_image(file: UploadFile = File(...)):
    file_extension = Path(file.filename or "").suffix
    saved_name = f"{uuid4().hex}{file_extension}"
    saved_path = UPLOAD_DIR / saved_name

    contents = await file.read()
    with open(saved_path, "wb") as buffer:
        buffer.write(contents)

    # NOTE: the file is on disk but not yet recorded in image_metadata.
    # /journals/generate can't see this image until persistence is wired.
    return {
        "message": "Image uploaded to disk. Persistence to image_metadata is pending.",
        "fileName": file.filename,
        "fileUrl": f"/uploads/{saved_name}",
    }


@router.delete("/gallery/{image_id}", response_model=DeleteGalleryResponse)
def delete_gallery_image(image_id: str):
    # TODO: delete the corresponding image_metadata row + the file on disk.
    raise HTTPException(status_code=501, detail="Delete not implemented yet.")
