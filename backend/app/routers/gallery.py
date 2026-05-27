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


mock_gallery = [
    {
        "id": "img_001",
        "fileName": "seoul_food.jpg",
        "fileUrl": "/uploads/seoul_food.jpg",
        "uploadedAt": datetime.utcnow(),
        "hasGPS": True,
        "city": "Seoul",
        "country": "South Korea",
    },
    {
        "id": "img_002",
        "fileName": "tokyo_street.jpg",
        "fileUrl": "/uploads/tokyo_street.jpg",
        "uploadedAt": datetime.utcnow(),
        "hasGPS": False,
        "city": None,
        "country": None,
    },
]


@router.get("/gallery", response_model=GalleryListResponse)
def get_gallery():
    return {"items": mock_gallery}


@router.post("/gallery/upload")
async def upload_gallery_image(file: UploadFile = File(...)):
    file_extension = Path(file.filename).suffix
    saved_name = f"{uuid4().hex}{file_extension}"
    saved_path = UPLOAD_DIR / saved_name

    contents = await file.read()
    with open(saved_path, "wb") as buffer:
        buffer.write(contents)

    new_item = {
        "id": f"img_{uuid4().hex[:8]}",
        "fileName": file.filename,
        "fileUrl": f"/uploads/{saved_name}",
        "uploadedAt": datetime.utcnow(),
        "hasGPS": False,
        "city": None,
        "country": None,
    }

    mock_gallery.insert(0, new_item)

    return {
        "message": "Image uploaded successfully.",
        "item": new_item,
    }


@router.delete("/gallery/{image_id}", response_model=DeleteGalleryResponse)
def delete_gallery_image(image_id: str):
    for index, item in enumerate(mock_gallery):
        if item["id"] == image_id:
            mock_gallery.pop(index)
            return {
                "message": "Image deleted successfully.",
                "deletedId": image_id,
            }

    raise HTTPException(status_code=404, detail="Image not found")
