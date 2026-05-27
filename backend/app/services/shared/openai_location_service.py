from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from openai import OpenAI

from app.core.config import OPENAI_API_KEY

DEFAULT_OPENAI_VISION_MODEL = "gpt-4.1-mini"
SUPPORTED_IMAGE_SUFFIXES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _require_api_key() -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env before calling OpenAI.")

    return OPENAI_API_KEY


def _resolve_mime_type(path: Path) -> str:
    suffix = path.suffix.lower()
    return SUPPORTED_IMAGE_SUFFIXES.get(suffix, "image/jpeg")


def _encode_image_as_data_url(path: Path) -> str:
    image_bytes = path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    mime_type = _resolve_mime_type(path)
    return f"data:{mime_type};base64,{image_base64}"


def _build_prompt() -> str:
    return (
        "Look at this image and guess where it was taken. "
        "Return only valid JSON with these keys: "
        '"place_name", "formatted_address". '
        "Use place_name for the most likely landmark, venue, restaurant, or business name if it can be inferred. "
        "If there is no reliable place name, use null. "
        "If you cannot infer an exact street address, return the most specific human-readable address you can, "
        "such as district, city, region, or country, in formatted_address. "
        "Do not include markdown, explanations, or extra keys."
    )


def _parse_location_response(response_text: str) -> dict[str, Any]:
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

    return {
        "place_name": payload.get("place_name"),
        "formatted_address": payload.get("formatted_address"),
    }


def analyze_image_location_with_openai(
    image_path: str | Path,
    *,
    model: str = DEFAULT_OPENAI_VISION_MODEL,
) -> dict[str, Any]:
    path = Path(image_path)

    if not path.exists():
        raise FileNotFoundError(f"Image file was not found: {path}")

    if not path.is_file():
        raise ValueError(f"Expected a file path, got: {path}")

    api_key = _require_api_key()
    client = OpenAI(api_key=api_key)
    data_url = _encode_image_as_data_url(path)

    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": _build_prompt()},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
    )

    response_text = response.output_text.strip()
    parsed = _parse_location_response(response_text)

    return {
        "file_name": path.name,
        "absolute_path": str(path.resolve()),
        "model": model,
        "place_name": parsed["place_name"],
        "formatted_address": parsed["formatted_address"],
        "raw_response_text": response_text,
    }
