from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.search import analyze_uploaded_search_image
from app.services.chat_tags import lounge_payload_for_tags, normalize_lounge_tags

router = APIRouter()

_ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_MAX_BYTES = 30 * 1024 * 1024


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    country_hint: str | None = Form(default=None),
    city_hint: str | None = Form(default=None),
    user_hint: str | None = Form(default=None),
    language: str | None = Form(default=None),
    force_openai_retry: bool = Form(default=False),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload JPEG, PNG, or WebP.")

    contents = await file.read()
    if len(contents) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 30 MB.")
    await file.seek(0)

    analysis = await analyze_uploaded_search_image(
        file,
        country_hint=country_hint,
        city_hint=city_hint,
        user_hint=user_hint,
        language=language or "en",
        force_openai_retry=force_openai_retry,
    )
    payload = analysis.to_dict()
    tags = normalize_lounge_tags(payload)
    payload["tags"] = tags
    payload["chat_lounges"] = lounge_payload_for_tags(tags)
    return payload
