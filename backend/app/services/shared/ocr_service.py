from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import GOOGLE_CLOUD_VISION_API_KEY

VISION_ANNOTATE_URL = "https://vision.googleapis.com/v1/images:annotate"
DEFAULT_OCR_DETECTION_TYPE = "DOCUMENT_TEXT_DETECTION"


# OCR은 Search와 Journal 둘 다 재사용하므로 shared 레이어에 둔다.
def _require_api_key() -> str:
    if not GOOGLE_CLOUD_VISION_API_KEY:
        raise RuntimeError(
            "GOOGLE_CLOUD_VISION_API_KEY is not set. Add it to backend/.env or rely on GOOGLE_MAPS_API_KEY fallback."
        )

    return GOOGLE_CLOUD_VISION_API_KEY


# Cloud Vision annotate 요청 바디를 OCR 용도로 만든다.
def _build_ocr_request(
    image_bytes: bytes,
    *,
    detection_type: str = DEFAULT_OCR_DETECTION_TYPE,
    language_hints: list[str] | None = None,
) -> dict[str, Any]:
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    image_context: dict[str, Any] = {}
    if language_hints:
        image_context["languageHints"] = language_hints

    request_payload: dict[str, Any] = {
        "image": {"content": image_base64},
        "features": [{"type": detection_type}],
    }
    if image_context:
        request_payload["imageContext"] = image_context

    return {"requests": [request_payload]}


# OCR 응답에서 전체 텍스트와 locale만 추려서 공용 포맷으로 맞춘다.
def _extract_ocr_payload(response_payload: dict[str, Any]) -> dict[str, Any]:
    if "error" in response_payload:
        raise RuntimeError(f"Cloud Vision OCR failed: {response_payload['error']}")

    full_text_annotation = response_payload.get("fullTextAnnotation", {})
    text_annotations = response_payload.get("textAnnotations", [])

    extracted_text = full_text_annotation.get("text")
    locale = None

    pages = full_text_annotation.get("pages", [])
    if pages:
        detected_languages = pages[0].get("property", {}).get("detectedLanguages", [])
        if detected_languages:
            locale = detected_languages[0].get("languageCode")

    if not extracted_text and text_annotations:
        extracted_text = text_annotations[0].get("description")
        locale = text_annotations[0].get("locale") or locale

    return {
        "extracted_text": (extracted_text or "").strip(),
        "locale": locale,
        "text_annotation_count": len(text_annotations),
    }


# 이미지 파일에서 다국어 OCR 텍스트를 추출한다.
def extract_text_with_cloud_vision(
    image_path: str | Path,
    *,
    detection_type: str = DEFAULT_OCR_DETECTION_TYPE,
    language_hints: list[str] | None = None,
    include_raw_response: bool = False,
) -> dict[str, Any]:
    path = Path(image_path)

    if not path.exists():
        raise FileNotFoundError(f"Image file was not found: {path}")

    if not path.is_file():
        raise ValueError(f"Expected a file path, got: {path}")

    api_key = _require_api_key()
    payload = _build_ocr_request(
        path.read_bytes(),
        detection_type=detection_type,
        language_hints=language_hints,
    )
    request_url = f"{VISION_ANNOTATE_URL}?key={api_key}"

    request = Request(
        request_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            raw_response = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Cloud Vision OCR failed with HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Cloud Vision OCR request failed: {exc}") from exc

    responses = raw_response.get("responses", [])
    if not responses:
        raise RuntimeError("Cloud Vision OCR returned no responses.")

    ocr_payload = _extract_ocr_payload(responses[0])
    result = {
        "file_name": path.name,
        "absolute_path": str(path.resolve()),
        "detection_type": detection_type,
        "locale": ocr_payload["locale"],
        "extracted_text": ocr_payload["extracted_text"],
        "text_annotation_count": ocr_payload["text_annotation_count"],
    }

    if include_raw_response:
        result["raw_response"] = raw_response

    return result
