from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any, Callable

from app.services.search.contracts import SearchHintContext
from app.services.shared.label_detection_service import analyze_label_detection
from app.services.shared.landmark_detection_service import analyze_landmark_detection
from app.services.shared.logo_detection_service import analyze_logo_detection
from app.services.shared.object_localization_service import analyze_object_localization
from app.services.shared.ocr_service import extract_text_with_cloud_vision
from app.services.shared.openai_location_service import analyze_image_location_with_openai
from app.services.shared.web_detection_service import analyze_web_detection


def _signal(
    source: str,
    *,
    status: str = "resolved",
    raw_response: dict[str, Any] | None = None,
    parsed_place_name: str | None = None,
    parsed_country: str | None = None,
    parsed_city: str | None = None,
    parsed_latitude: float | None = None,
    parsed_longitude: float | None = None,
    signal_score: float | None = None,
    failure_reason: str | None = None,
    latency_ms: int | None = None,
) -> dict[str, Any]:
    return {
        "source": source,
        "status": status,
        "raw_response": raw_response,
        "parsed_place_name": parsed_place_name,
        "parsed_country": parsed_country,
        "parsed_city": parsed_city,
        "parsed_latitude": parsed_latitude,
        "parsed_longitude": parsed_longitude,
        "signal_score": signal_score,
        "failure_reason": failure_reason,
        "latency_ms": latency_ms,
    }


def _timed(fn: Callable[[], dict[str, Any]]) -> tuple[dict[str, Any] | Exception, int]:
    start = time.perf_counter()
    try:
        return fn(), int((time.perf_counter() - start) * 1000)
    except Exception as exc:
        return exc, int((time.perf_counter() - start) * 1000)


def _landmark_signal(image_path: Path) -> dict[str, Any]:
    raw, ms = _timed(lambda: analyze_landmark_detection(image_path))
    if isinstance(raw, Exception):
        return _signal("vision_landmark", status="failed", failure_reason=str(raw), latency_ms=ms)
    top = raw.get("top_landmark") or {}
    loc = (top.get("locations") or [{}])[0] if top else {}
    return _signal(
        "vision_landmark",
        status="resolved" if top.get("description") else "empty",
        raw_response=raw,
        parsed_place_name=top.get("description"),
        parsed_latitude=loc.get("latitude"),
        parsed_longitude=loc.get("longitude"),
        signal_score=top.get("score"),
        latency_ms=ms,
    )


def _label_signal(image_path: Path) -> dict[str, Any]:
    raw, ms = _timed(lambda: analyze_label_detection(image_path))
    if isinstance(raw, Exception):
        return _signal("vision_label", status="failed", failure_reason=str(raw), latency_ms=ms)
    top = raw.get("top_label") or {}
    return _signal(
        "vision_label",
        status="resolved" if top.get("description") else "empty",
        raw_response=raw,
        parsed_place_name=top.get("description"),  # broad scene tag, not a place
        signal_score=top.get("score"),
        latency_ms=ms,
    )


def _object_signal(image_path: Path) -> dict[str, Any]:
    raw, ms = _timed(lambda: analyze_object_localization(image_path))
    if isinstance(raw, Exception):
        return _signal("vision_object", status="failed", failure_reason=str(raw), latency_ms=ms)
    top = raw.get("top_object") or {}
    return _signal(
        "vision_object",
        status="resolved" if top.get("name") else "empty",
        raw_response=raw,
        parsed_place_name=top.get("name"),
        signal_score=top.get("score"),
        latency_ms=ms,
    )


def _web_signal(image_path: Path) -> dict[str, Any]:
    raw, ms = _timed(lambda: analyze_web_detection(image_path))
    if isinstance(raw, Exception):
        return _signal("vision_web", status="failed", failure_reason=str(raw), latency_ms=ms)
    best_guess = raw.get("best_guess")
    top_entity = (raw.get("web_entities") or [{}])[0] if raw.get("web_entities") else {}
    return _signal(
        "vision_web",
        status="resolved" if best_guess or top_entity.get("description") else "empty",
        raw_response=raw,
        parsed_place_name=best_guess or top_entity.get("description"),
        signal_score=top_entity.get("score"),
        latency_ms=ms,
    )


def _logo_signal(image_path: Path) -> dict[str, Any]:
    raw, ms = _timed(lambda: analyze_logo_detection(image_path))
    if isinstance(raw, Exception):
        return _signal("vision_logo", status="failed", failure_reason=str(raw), latency_ms=ms)
    top = raw.get("top_logo") or {}
    return _signal(
        "vision_logo",
        status="resolved" if top.get("description") else "empty",
        raw_response=raw,
        parsed_place_name=top.get("description"),
        signal_score=top.get("score"),
        latency_ms=ms,
    )


def _ocr_signal(image_path: Path) -> dict[str, Any]:
    raw, ms = _timed(lambda: extract_text_with_cloud_vision(image_path))
    if isinstance(raw, Exception):
        return _signal("vision_ocr", status="failed", failure_reason=str(raw), latency_ms=ms)
    text = (raw.get("extracted_text") or "").strip()
    return _signal(
        "vision_ocr",
        status="resolved" if text else "empty",
        raw_response=raw,
        parsed_place_name=text[:255] if text else None,  # OCR text used as candidate query later
        latency_ms=ms,
    )


def _openai_signal(image_path: Path, hints: SearchHintContext, user_hint: str | None) -> dict[str, Any]:
    raw, ms = _timed(
        lambda: analyze_image_location_with_openai(
            image_path,
            country_hint=hints.normalized_country(),
            city_hint=hints.normalized_city(),
            user_hint=user_hint or hints.normalized_user_hint(),
        )
    )
    if isinstance(raw, Exception):
        return _signal("gpt4o_vision", status="failed", failure_reason=str(raw), latency_ms=ms)
    place = raw.get("place_name")
    address = raw.get("formatted_address")
    return _signal(
        "gpt4o_vision",
        status="resolved" if place or address else "empty",
        raw_response=raw,
        parsed_place_name=place or address,
        latency_ms=ms,
    )


def build_exif_gps_signal(gps: dict[str, Any] | None) -> dict[str, Any] | None:
    """EXIF GPS is computed before the parallel fan-out; if present we add it
    as the highest-weighted signal."""

    if not gps or gps.get("latitude") is None or gps.get("longitude") is None:
        return None
    return _signal(
        "exif_gps",
        status="resolved",
        raw_response={"gps": gps},
        parsed_latitude=float(gps["latitude"]),
        parsed_longitude=float(gps["longitude"]),
        signal_score=1.0,
    )


async def collect_signals(
    image_path: str | Path,
    *,
    hints: SearchHintContext,
    user_hint: str | None = None,
) -> list[dict[str, Any]]:
    """Fan out to all Layer 2-3 helpers in parallel. Each helper either
    returns a normalized signal dict or, on failure, a dict with status
    'failed' — one failing API never blocks the rest."""

    path = Path(image_path)
    tasks = [
        asyncio.to_thread(_landmark_signal, path),
        asyncio.to_thread(_label_signal, path),
        asyncio.to_thread(_object_signal, path),
        asyncio.to_thread(_web_signal, path),
        asyncio.to_thread(_logo_signal, path),
        asyncio.to_thread(_ocr_signal, path),
        asyncio.to_thread(_openai_signal, path, hints, user_hint),
    ]
    return list(await asyncio.gather(*tasks))
