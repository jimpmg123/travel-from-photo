from fastapi import APIRouter, File, Form, UploadFile

from app.services.search import analyze_uploaded_search_image
from app.services.chat_tags import lounge_payload_for_tags, normalize_lounge_tags

router = APIRouter()


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    country_hint: str | None = Form(default=None),
    city_hint: str | None = Form(default=None),
    user_hint: str | None = Form(default=None),
    force_openai_retry: bool = Form(default=False),
):
    analysis = await analyze_uploaded_search_image(
        file,
        country_hint=country_hint,
        city_hint=city_hint,
        user_hint=user_hint,
        force_openai_retry=force_openai_retry,
    )
    payload = analysis.to_dict()
    tags = normalize_lounge_tags(payload)
    payload["tags"] = tags
    payload["chat_lounges"] = lounge_payload_for_tags(tags)
    return payload
