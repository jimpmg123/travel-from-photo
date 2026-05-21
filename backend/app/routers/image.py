from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.search import analyze_uploaded_search_image

router = APIRouter()


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    country_hint: str | None = Form(default=None),
    city_hint: str | None = Form(default=None),
    user_hint: str | None = Form(default=None),
    force_openai_retry: bool = Form(default=False),
    db: Session = Depends(get_db),
):
    analysis = await analyze_uploaded_search_image(
        file,
        country_hint=country_hint,
        city_hint=city_hint,
        user_hint=user_hint,
        force_openai_retry=force_openai_retry,
        db=db,
    )
    return analysis.to_dict()
