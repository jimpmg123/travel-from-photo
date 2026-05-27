from __future__ import annotations

import base64
import json
import logging
import time
from pathlib import Path
from typing import Any
import asyncio

from openai import AsyncOpenAI
from app.core.config import OPENAI_API_KEY, OPENAI_VISION_MODEL
from app.services.search.contracts import RawSignal, SearchHintContext

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=OPENAI_API_KEY)


def _encode_image(image_path: Path) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def _format_hints(hints: SearchHintContext | None) -> str:
    """Render the user hints into the prompt context. Empty when no hints
    were given — kept terse so the model doesn't latch onto noise."""
    if hints is None:
        return ""
    parts: list[str] = []
    if hints.normalized_country():
        parts.append(f"country={hints.normalized_country()}")
    if hints.normalized_city():
        parts.append(f"city={hints.normalized_city()}")
    if hints.normalized_user_hint():
        parts.append(f"freeform={hints.normalized_user_hint()}")
    return "; ".join(parts) if parts else ""


async def analyze_gpt_main_voter(
    image_path: str | Path,
    ocr_text: str | None,
    exif_clues: dict[str, Any] | None,
    hints: SearchHintContext | None = None,
    timeout_sec: float = 10.0,
) -> list[dict[str, Any]]:
    path = Path(image_path)
    if not path.exists():
        logger.error(f"Image path does not exist: {path}")
        return []

    start_time = time.perf_counter()
    try:
        base64_image = _encode_image(path)
        hint_line = _format_hints(hints)
        context_prompt = (
            f"OCR Extracted Text: {ocr_text or 'None'}\n"
            f"EXIF Location Clues: {json.dumps(exif_clues or {})}\n"
            f"User Hints (TRUST these heavily — the user actually visited the place): "
            f"{hint_line or 'None'}"
        )

        system_prompt = (
            "You are an independent location voter. Analyze the image, OCR text, and EXIF clues. "
            "Propose 2 to 3 specific place candidates. For each candidate, provide the place name, "
            "a confidence score between 0.0 and 1.0, and your reasoning. "
            "Do not consider any external system verdicts. "
            "IMPORTANT: If user hints are provided (country, city, freeform), STRONGLY prefer "
            "candidates that match those hints. The user knows where they were — only deviate "
            "from the hint when the image content blatantly contradicts it. "
            "Respond strictly in JSON format with a top-level 'candidates' array. "
            "Example format: {\"candidates\": [{\"place_name\": \"...\", \"score\": 0.85, \"reasoning\": \"...\"}]}"
        )

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=OPENAI_VISION_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": context_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            ),
            timeout=timeout_sec
        )

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        content = response.choices[0].message.content
        if not content:
            return []

        data = json.loads(content)
        candidates_data = data.get("candidates", [])

        signals = []
        for item in candidates_data:
            place_name = item.get("place_name")
            if not place_name:
                continue
                
            raw_signal = RawSignal(
                source="gpt4o_main",
                status="resolved",
                raw_response=data,
                parsed_place_name=place_name,
                signal_score=float(item.get("score", 0.6)),
                latency_ms=latency_ms,
                tier=2
            )
            
            signals.append({
                "place_name": place_name,
                "reasoning": item.get("reasoning"),
                "signal": raw_signal.to_dict()
            })
            
        return signals

    except Exception as e:
        logger.error(f"GPT main voter analysis failed: {str(e)}")
        return []