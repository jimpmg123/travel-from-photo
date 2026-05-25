"""GPT-4.1-mini Vision call that extracts per-photo features + the journal text
in one shot.

Why a single call: the spec deliberately fuses categorical extraction and the
warm 1st-person narrative into one response so we pay one prompt token bill per
image instead of two. The system prompt forbids re-identifying the location
(GPS+Places already solved 'where').

Returns a dict with the 8 categorical features, detail_note, journal_text, and
the OpenAI model_version actually used (so the entry's provenance is accurate
when the deployment routes us to a dated alias).
"""
from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Any

from openai import OpenAI

from app.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

DEFAULT_JOURNAL_VISION_MODEL = "gpt-4.1-mini"

# Hard cap on how long we'll wait for OpenAI per image. This is the cascading
# failure prevention — if their API stalls, our background worker doesn't.
GPT_REQUEST_TIMEOUT_SECONDS = 25.0

# Default journal_text injected when GPT fails after retry. Visible to the
# user so they know to add their own note instead of seeing a blank entry.
DEFAULT_JOURNAL_TEXT_FALLBACK = (
    "(automatic description unavailable for this photo — feel free to add your own note.)"
)

SUPPORTED_IMAGE_SUFFIXES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

# Allowed vocabulary per field — values outside these sets get coerced to None
# so downstream stats don't accumulate garbage labels.
ALLOWED_VALUES: dict[str, set[str]] = {
    "shooting_style": {
        "macro_detail", "close_up", "mid_shot",
        "wide_landscape", "street_candid", "aerial_elevated",
    },
    "subject_focus": {
        "architecture", "food_drink", "nature_wildlife", "people_crowd",
        "transportation", "signage_text", "interior_space", "abstract_pattern",
    },
    "time_of_day": {
        "dawn", "morning", "midday", "golden_hour", "blue_hour", "night",
    },
    "atmosphere": {
        "crowded_busy", "empty_solitary", "peaceful_calm",
        "energetic_lively", "mysterious_moody", "romantic_intimate",
    },
    "weather_light": {
        "clear_sunny", "overcast_soft", "rainy_wet",
        "foggy_misty", "snowy", "artificial_light",
    },
    "composition_habit": {
        "symmetry", "leading_lines", "texture_pattern",
        "framing", "rule_of_thirds", "centered_subject",
    },
    "color_mood": {
        "warm_golden", "cool_blue", "vibrant_saturated",
        "muted_desaturated", "monochromatic", "high_contrast",
    },
    "cultural_layer": {
        "local_everyday", "tourist_landmark", "religious_spiritual",
        "modern_commercial", "historical_heritage", "nature_escape",
    },
}

CATEGORICAL_FIELDS = tuple(ALLOWED_VALUES.keys())

SYSTEM_PROMPT = """You are a travel photo analyst.
Your job is to extract rich, detailed characteristics from a travel photo
that the user may not consciously notice about their own photography habits.

You will receive:
- A travel photo
- Location context from GPS metadata (country, city, place name)

Your goal is NOT to identify the location (it is already known).
Your goal is to extract what kind of photo this is,
how it was taken, and what it feels like.

CRITICAL RULES:
1. Location is already provided. Do not re-identify it.
2. Be specific and precise. Avoid generic descriptions.
3. Respond ONLY in the JSON format below.
   No preamble, no markdown, no explanation outside JSON.
4. For journal_text: write in a warm, personal travel diary tone.
   Use the location + features together to write 2-3 sentences.
   It should feel like the user wrote it themselves, not like an AI summary.
"""


def _require_api_key() -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env before calling OpenAI.")
    return OPENAI_API_KEY


def _resolve_mime_type(path: Path) -> str:
    return SUPPORTED_IMAGE_SUFFIXES.get(path.suffix.lower(), "image/jpeg")


def _encode_image_as_data_url(path: Path) -> str:
    image_bytes = path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{_resolve_mime_type(path)};base64,{image_base64}"


def _build_user_prompt(
    *,
    country: str | None,
    city: str | None,
    place_name: str | None,
    captured_at: datetime | None,
) -> str:
    return (
        "Location context (already confirmed via GPS):\n"
        f"- Country: {country or 'Unknown'}\n"
        f"- City: {city or 'Unknown'}\n"
        f"- Place name: {place_name or 'Unknown'}\n"
        f"- Captured at: {captured_at.isoformat() if captured_at else 'Unknown'}\n\n"
        "Analyze this photo and return the following JSON:\n\n"
        "{\n"
        '  "shooting_style": <one of: "macro_detail" | "close_up" | "mid_shot" | "wide_landscape" | "street_candid" | "aerial_elevated">,\n'
        '  "subject_focus": <one of: "architecture" | "food_drink" | "nature_wildlife" | "people_crowd" | "transportation" | "signage_text" | "interior_space" | "abstract_pattern">,\n'
        '  "time_of_day": <one of: "dawn" | "morning" | "midday" | "golden_hour" | "blue_hour" | "night">,\n'
        '  "atmosphere": <one of: "crowded_busy" | "empty_solitary" | "peaceful_calm" | "energetic_lively" | "mysterious_moody" | "romantic_intimate">,\n'
        '  "weather_light": <one of: "clear_sunny" | "overcast_soft" | "rainy_wet" | "foggy_misty" | "snowy" | "artificial_light">,\n'
        '  "composition_habit": <one of: "symmetry" | "leading_lines" | "texture_pattern" | "framing" | "rule_of_thirds" | "centered_subject">,\n'
        '  "color_mood": <one of: "warm_golden" | "cool_blue" | "vibrant_saturated" | "muted_desaturated" | "monochromatic" | "high_contrast">,\n'
        '  "cultural_layer": <one of: "local_everyday" | "tourist_landmark" | "religious_spiritual" | "modern_commercial" | "historical_heritage" | "nature_escape">,\n'
        '  "detail_note": "<one specific detail that stands out, revealing the photographer\'s eye. Be concrete.>",\n'
        '  "journal_text": "<2-3 sentences in a warm personal travel diary tone, using location + features together.>"\n'
        "}\n"
    )


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    cleaned = raw_text.strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise RuntimeError(f"GPT Vision returned non-JSON: {cleaned!r}")
        payload = json.loads(cleaned[start : end + 1])

    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected a JSON object, got {type(payload).__name__}")
    return payload


def _coerce_categorical(field: str, value: Any) -> str | None:
    """Drop labels GPT made up. Off-vocab values become None so they don't
    pollute the stats bucket later."""
    allowed = ALLOWED_VALUES.get(field)
    if not isinstance(value, str) or not allowed:
        return None
    return value if value in allowed else None


def _coerce_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _safe_default_payload(model_label: str) -> dict[str, Any]:
    """Graceful-degradation payload — all categorical fields null, journal
    text replaced by a user-facing fallback so the entry still renders
    without breaking the page. Used when GPT times out, returns invalid
    JSON, or trips its safety policy."""
    result: dict[str, Any] = {field: None for field in CATEGORICAL_FIELDS}
    result["detail_note"] = None
    result["journal_text"] = DEFAULT_JOURNAL_TEXT_FALLBACK
    result["model_version"] = model_label
    result["degraded"] = True
    return result


def analyze_journal_photo(
    image_path: str | Path,
    *,
    country: str | None = None,
    city: str | None = None,
    place_name: str | None = None,
    captured_at: datetime | None = None,
    model: str = DEFAULT_JOURNAL_VISION_MODEL,
) -> dict[str, Any]:
    """Best-effort GPT Vision call. Never raises for API/JSON issues —
    instead returns a safe payload with `degraded=True` so the orchestrator
    can persist the entry with fallback text. Only filesystem errors
    (missing image) propagate."""
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    try:
        api_key = _require_api_key()
    except RuntimeError:
        logger.exception("OPENAI_API_KEY missing — returning fallback")
        return _safe_default_payload(model)

    client = OpenAI(api_key=api_key, timeout=GPT_REQUEST_TIMEOUT_SECONDS)
    try:
        data_url = _encode_image_as_data_url(path)
    except Exception:
        logger.exception("failed to encode image %s — returning fallback", path)
        return _safe_default_payload(model)

    user_text = _build_user_prompt(
        country=country, city=city, place_name=place_name, captured_at=captured_at,
    )

    # OpenAI client surfaces timeouts/connection errors as exceptions; the
    # SDK can also raise during streaming/parse. Anything thrown here becomes
    # graceful fallback rather than a job-killing exception.
    try:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": user_text},
                        {"type": "input_image", "image_url": data_url},
                    ],
                },
            ],
        )
    except Exception:
        logger.exception("GPT responses.create failed for %s — returning fallback", path)
        return _safe_default_payload(model)

    raw_text = getattr(response, "output_text", "") or ""
    try:
        payload = _extract_json_object(raw_text)
    except Exception:
        logger.exception("GPT returned non-JSON for %s — returning fallback", path)
        return _safe_default_payload(getattr(response, "model", None) or model)

    result: dict[str, Any] = {field: _coerce_categorical(field, payload.get(field)) for field in CATEGORICAL_FIELDS}
    result["detail_note"] = _coerce_text(payload.get("detail_note"))
    journal_text = _coerce_text(payload.get("journal_text"))
    # If GPT returned JSON shape-correctly but left journal_text empty (e.g.
    # safety-filtered partial response), still substitute the fallback so the
    # frontend never has to render an empty card.
    result["journal_text"] = journal_text or DEFAULT_JOURNAL_TEXT_FALLBACK
    result["model_version"] = getattr(response, "model", None) or model
    result["degraded"] = journal_text is None
    return result
