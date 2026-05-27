from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from openai import OpenAI

from app.core.config import OPENAI_API_KEY
from app.services.journal.contracts import JournalObservation
from app.services.shared.ocr_service import extract_text_with_cloud_vision

DEFAULT_OPENAI_DOCUMENT_MODEL = "gpt-4.1-mini"
ALLOWED_DOCUMENT_TYPES = {
    "transport_ticket",
    "lodging_confirmation",
    "museum_ticket",
    "receipt",
    "map_screenshot",
    "generic_document",
}


# OCR 이후의 문서 subtype 판단은 Journal 규칙이 섞여 있으므로 journal 레이어에 둔다.
def _require_api_key() -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env before calling OpenAI.")

    return OPENAI_API_KEY


# OpenAI가 항상 같은 JSON 포맷으로 돌려주도록 프롬프트를 고정한다.
def _build_document_classification_prompt(extracted_text: str) -> str:
    return (
        "You classify travel-related document text.\n"
        "Return only valid JSON with keys: "
        '"document_type", "confidence", "reason".\n'
        "Allowed document_type values are: "
        "transport_ticket, lodging_confirmation, museum_ticket, receipt, map_screenshot, generic_document.\n"
        "confidence must be a number between 0 and 1.\n"
        "Use generic_document when the text is too weak or unclear.\n"
        "OCR text:\n"
        f"{extracted_text}"
    )


# 응답이 JSON 바깥에 설명을 붙여도 객체만 최대한 복구해서 사용한다.
def _parse_document_classification_response(response_text: str) -> dict[str, Any]:
    cleaned_text = response_text.strip()

    try:
        payload = json.loads(cleaned_text)
    except json.JSONDecodeError:
        start = cleaned_text.find("{")
        end = cleaned_text.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise RuntimeError(f"OpenAI response was not valid JSON: {cleaned_text}")

        payload = json.loads(cleaned_text[start : end + 1])

    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected a JSON object from OpenAI, got: {type(payload).__name__}")

    document_type = str(payload.get("document_type") or "generic_document").strip()
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        document_type = "generic_document"

    try:
        confidence = float(payload.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(confidence, 1.0))

    reason = payload.get("reason")
    if reason is not None:
        reason = str(reason).strip() or None

    return {
        "document_type": document_type,
        "confidence": confidence,
        "reason": reason,
    }


# OCR 텍스트를 OpenAI에 보내 문서 subtype을 얻는다.
def classify_document_text(
    extracted_text: str,
    *,
    model: str = DEFAULT_OPENAI_DOCUMENT_MODEL,
) -> dict[str, Any]:
    normalized_text = extracted_text.strip()
    if not normalized_text:
        return {
            "document_type": "generic_document",
            "confidence": 0.0,
            "reason": "OCR returned no usable text.",
            "raw_response_text": "",
            "model": model,
        }

    api_key = _require_api_key()
    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "user",
                "content": [{"type": "input_text", "text": _build_document_classification_prompt(normalized_text)}],
            }
        ],
    )

    response_text = response.output_text.strip()
    parsed = _parse_document_classification_response(response_text)
    return {
        "document_type": parsed["document_type"],
        "confidence": parsed["confidence"],
        "reason": parsed["reason"],
        "raw_response_text": response_text,
        "model": model,
    }


# Observation이 문서 계열로 판정됐을 때 OCR과 subtype 분류를 한 번에 채워 넣는다.
def enrich_observation_document(
    observation: JournalObservation,
    *,
    model: str = DEFAULT_OPENAI_DOCUMENT_MODEL,
    language_hints: list[str] | None = None,
) -> JournalObservation:
    if observation.scene_label != "document_like":
        return observation

    if not observation.representative_image_path:
        raise ValueError(
            f"Observation {observation.observation_id} is document_like but has no representative_image_path."
        )

    image_path = Path(observation.representative_image_path)
    ocr_result = extract_text_with_cloud_vision(
        image_path,
        language_hints=language_hints,
    )
    observation.ocr_text = ocr_result["extracted_text"]
    observation.ocr_locale = ocr_result["locale"]

    classification = classify_document_text(
        observation.ocr_text,
        model=model,
    )
    observation.document_type = classification["document_type"]
    observation.document_confidence = classification["confidence"]

    reasons = [part for part in [observation.classification_reason, classification["reason"]] if part]
    observation.classification_reason = " ".join(reasons) or observation.classification_reason
    return observation
