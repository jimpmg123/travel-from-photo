"""GPT-4.1-mini call that turns the user's travel stats into 3 destination
recommendations with reasoning.

Per spec, every recommendation MUST cite its rationale ("why"). The system
prompt enforces that — without grounding, GPT is free to hallucinate
plausible-but-baseless picks, which is the single biggest risk in the
recommendation feature.

Returns: { recommendations: [{ name, country, reason }, ...] } parsed from
the model's JSON output, plus the model_version actually used.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from openai import OpenAI

from app.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

DEFAULT_RECOMMENDATION_MODEL = "gpt-4.1-mini"

SYSTEM_PROMPT = """You are a travel recommender for an individual user.

You will receive a JSON blob summarizing the user's past travel:
- Which countries and cities they have visited
- Their photo subject distribution (food, architecture, nature, etc.)
- Their atmosphere preferences (crowded vs empty, day vs night, etc.)
- Their cultural-layer preferences (local everyday, religious, historical, etc.)

Your job is to suggest exactly 3 new destinations that match the patterns
you see, with concrete reasoning rooted ONLY in the provided stats.

CRITICAL RULES:
1. Recommend destinations the user has NOT visited (avoid their existing countries/cities).
2. Every recommendation MUST cite the specific stat that drove it. No vague reasons.
3. If the stats are too sparse to make a confident pick, say so honestly in the reason.
4. Output ONLY JSON in this shape, no preamble or markdown:
   {"recommendations": [
     {"name": "<city>", "country": "<country>", "reason": "<1-2 sentence rationale citing stats>"},
     ...3 items
   ]}
"""


def _require_api_key() -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env before calling OpenAI.")
    return OPENAI_API_KEY


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    cleaned = raw_text.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise RuntimeError(f"recommendation GPT returned non-JSON: {cleaned!r}")
        return json.loads(cleaned[start : end + 1])


def generate_recommendations(
    stats: dict[str, Any],
    *,
    model: str = DEFAULT_RECOMMENDATION_MODEL,
) -> dict[str, Any]:
    """Returns {recommendations: [...], model_version: str, low_data: bool}.
    low_data flags whether the user has too few entries for confident picks —
    UI can use it to show a 'collect more journals for better suggestions' note."""
    photo_count = int(stats.get("photo_count") or 0)
    low_data = photo_count < 10  # spec threshold for "weak signal"

    api_key = _require_api_key()
    client = OpenAI(api_key=api_key)

    user_text = (
        "Here are the user's travel stats as JSON:\n\n"
        + json.dumps(stats, ensure_ascii=False, indent=2)
        + "\n\nReturn exactly 3 destination recommendations as specified."
    )

    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
        ],
    )

    payload = _extract_json_object(response.output_text)
    recommendations = payload.get("recommendations") or []
    if not isinstance(recommendations, list):
        recommendations = []

    return {
        "recommendations": recommendations[:3],
        "model_version": getattr(response, "model", None) or model,
        "low_data": low_data,
    }
