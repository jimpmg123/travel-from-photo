from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any

from app.services.search.contracts import RawSignal, SearchHintContext
from app.services.shared.landmark_detection_service import analyze_landmark_detection
from app.services.shared.logo_detection_service import analyze_logo_detection
from app.services.shared.ocr_service import extract_text_with_cloud_vision
from app.services.shared.web_detection_service import analyze_web_detection

logger = logging.getLogger(__name__)


def _timed(fn) -> tuple[Any, int]:
    start = time.perf_counter()
    try:
        return fn(), int((time.perf_counter() - start) * 1000)
    except Exception as exc:
        return exc, int((time.perf_counter() - start) * 1000)


COUNTRY_TO_OCR_LANGUAGES: dict[str, list[str]] = {
    "korea": ["ko"],
    "south korea": ["ko"],
    "republic of korea": ["ko"],
    "north korea": ["ko"],
    "japan": ["ja"],
    "china": ["zh"],
    "taiwan": ["zh-TW"],
    "hong kong": ["zh-HK"],
    "thailand": ["th"],
    "vietnam": ["vi"],
    "russia": ["ru"],
    "saudi arabia": ["ar"],
    "uae": ["ar"],
    "united arab emirates": ["ar"],
    "israel": ["he"],
    "greece": ["el"],
}


def _ocr_languages_for(country_hint: str | None) -> list[str] | None:
    if not country_hint:
        return None
    key = country_hint.strip().lower()
    return COUNTRY_TO_OCR_LANGUAGES.get(key)


def _ocr_signal(processed_path: Path, language_hints: list[str] | None = None) -> RawSignal:
    raw, latency = _timed(
        lambda: extract_text_with_cloud_vision(processed_path, language_hints=language_hints)
    )
    if isinstance(raw, Exception):
        return RawSignal(
            source="vision_ocr",
            status="failed",
            failure_reason=str(raw),
            latency_ms=latency,
            tier=1,
        )
    text = (raw.get("extracted_text") or "").strip()
    cleaned = text[:255] if text else None
    if cleaned and not _is_plausible_place_text(cleaned):
        cleaned = None
    return RawSignal(
        source="vision_ocr",
        status="resolved" if cleaned else "empty",
        raw_response=raw,
        parsed_place_name=cleaned,
        latency_ms=latency,
        tier=1,
    )


def _landmark_signal(processed_path: Path) -> RawSignal:
    raw, latency = _timed(lambda: analyze_landmark_detection(processed_path))
    if isinstance(raw, Exception):
        return RawSignal(
            source="vision_landmark",
            status="failed",
            failure_reason=str(raw),
            latency_ms=latency,
            tier=1,
        )
    top = raw.get("top_landmark") or {}
    if not top.get("description"):
        return RawSignal(
            source="vision_landmark",
            status="empty",
            raw_response=raw,
            latency_ms=latency,
            tier=1,
        )
    loc = (top.get("locations") or [{}])[0]
    return RawSignal(
        source="vision_landmark",
        status="resolved",
        raw_response=raw,
        parsed_place_name=top.get("description"),
        parsed_latitude=loc.get("latitude"),
        parsed_longitude=loc.get("longitude"),
        signal_score=top.get("score"),
        latency_ms=latency,
        tier=1,
    )


def _calibrate_web_score(raw: dict[str, Any]) -> float:
    full_count = int(raw.get("full_matching_images_count") or 0)
    partial_count = int(raw.get("partial_matching_images_count") or 0)
    if full_count > 0:
        return 0.95
    if partial_count >= 5:
        return 0.85
    if raw.get("best_guess"):
        return 0.75
    top_score = ((raw.get("top_web_entity") or {}).get("score")) or 0.0
    return max(float(top_score), 0.55)


_NON_PLACE_PREFIXES = ("file:", "image:", "category:", "user:", "talk:", "wikipedia:", "commons:")
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tiff", ".bmp")


def _clean_page_title(title: str) -> str:
    if not title:
        return ""
    for sep in ("|", " - ", " — ", " :: ", " · "):
        if sep in title:
            title = title.split(sep)[0]
    return title.strip()


def _is_plausible_place_text(text: str) -> bool:
    """Reject text that obviously isn't a place name — file names, URL
    fragments, OCR garbage, etc. Keeps signal pool clean before we send
    each one off to Geocoding."""
    if not text:
        return False
    s = text.strip()
    if len(s) < 3 or len(s) > 80:
        return False
    low = s.lower()
    if any(low.startswith(p) for p in _NON_PLACE_PREFIXES):
        return False
    if any(low.endswith(ext) for ext in _IMAGE_EXTENSIONS):
        return False
    if "/" in s or "\\" in s or "http" in low:
        return False
    # Need at least one alphanumeric-y character (kills pure symbols)
    if not any(ch.isalnum() for ch in s):
        return False
    # Kill mixed-script noise: if more than 2 distinct script families
    # appear (Latin + Hangul + CJK + Cyrillic + ...) we treat as junk.
    # OCR mis-reads typically smash 3+ scripts into one short string.
    families = 0
    if any("a" <= ch.lower() <= "z" for ch in s):
        families += 1
    if any("가" <= ch <= "힣" for ch in s):  # Hangul syllables
        families += 1
    if any("一" <= ch <= "鿿" for ch in s):  # CJK ideographs
        families += 1
    if any("぀" <= ch <= "ヿ" for ch in s):  # Hiragana/Katakana
        families += 1
    if any("Ѐ" <= ch <= "ӿ" for ch in s):  # Cyrillic
        families += 1
    if families >= 3:
        return False
    return True


def _web_signal(original_path: Path) -> RawSignal:
    raw, latency = _timed(lambda: analyze_web_detection(original_path))
    if isinstance(raw, Exception):
        return RawSignal(
            source="vision_web",
            status="failed",
            failure_reason=str(raw),
            latency_ms=latency,
            tier=1,
        )
    best_guess = raw.get("best_guess")
    top_entity = raw.get("top_web_entity") or {}
    candidates = [best_guess, top_entity.get("description")]
    place_name: str | None = None
    for cand in candidates:
        if cand and _is_plausible_place_text(cand):
            place_name = cand
            break
    if not place_name:
        pages = raw.get("pages_with_matching_images") or []
        for page in pages:
            cleaned = _clean_page_title(page.get("page_title") or "")
            if _is_plausible_place_text(cleaned):
                place_name = cleaned
                break
    return RawSignal(
        source="vision_web",
        status="resolved" if place_name else "empty",
        raw_response=raw,
        parsed_place_name=place_name,
        signal_score=_calibrate_web_score(raw) if place_name else None,
        latency_ms=latency,
        tier=1,
    )


def _web_extra_signals(raw: dict[str, Any]) -> list[RawSignal]:
    if not isinstance(raw, dict):
        return []
    base_score = _calibrate_web_score(raw)
    primary_name = (raw.get("best_guess") or (raw.get("top_web_entity") or {}).get("description") or "").strip().lower()

    seen: set[str] = {primary_name} if primary_name else set()
    extras: list[RawSignal] = []

    for entity in (raw.get("web_entities") or [])[:4]:
        desc = (entity.get("description") or "").strip()
        if not _is_plausible_place_text(desc):
            continue
        key = desc.lower()
        if key in seen:
            continue
        seen.add(key)
        entity_score = float(entity.get("score") or 0.0)
        score = max(entity_score, base_score - 0.15)
        extras.append(RawSignal(
            source="vision_web",
            status="resolved",
            raw_response={"from": "web_entity", "entity": entity},
            parsed_place_name=desc,
            signal_score=round(score, 3),
            tier=1,
        ))

    for page in (raw.get("pages_with_matching_images") or [])[:3]:
        cleaned = _clean_page_title(page.get("page_title") or "")
        if not _is_plausible_place_text(cleaned):
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        extras.append(RawSignal(
            source="vision_web",
            status="resolved",
            raw_response={"from": "page_title", "page": page},
            parsed_place_name=cleaned[:255],
            signal_score=round(base_score - 0.20, 3),
            tier=1,
        ))

    return extras


def _logo_signal(processed_path: Path) -> RawSignal:
    raw, latency = _timed(lambda: analyze_logo_detection(processed_path))
    if isinstance(raw, Exception):
        return RawSignal(
            source="vision_logo",
            status="failed",
            failure_reason=str(raw),
            latency_ms=latency,
            tier=1,
        )
    top = raw.get("top_logo") or {}
    return RawSignal(
        source="vision_logo",
        status="resolved" if top.get("description") else "empty",
        raw_response=raw,
        parsed_place_name=top.get("description"),
        signal_score=top.get("score"),
        latency_ms=latency,
        tier=1,
    )


async def collect_tier1_signals(
    processed_path: str | Path,
    original_path: str | Path,
    *,
    hints: SearchHintContext,
    skip_landmark: bool = False,
    timeout_sec: float = 4.5
) -> list[RawSignal]:
    p_path = Path(processed_path)
    o_path = Path(original_path)
    ocr_langs = _ocr_languages_for(hints.normalized_country())

    async def _safe_execute(func, *args, source_name: str) -> RawSignal:
        try:
            task = asyncio.to_thread(func, *args)
            return await asyncio.wait_for(task, timeout=timeout_sec)
        except asyncio.TimeoutError:
            logger.error(f"[Tier 1] Timeout ({timeout_sec}s) on API: {source_name}")
            return RawSignal(
                source=source_name,
                status="failed",
                failure_reason="TimeoutError: API Server Unresponsive",
                latency_ms=int(timeout_sec * 1000),
                tier=1,
            )
        except Exception as e:
            logger.error(f"[Tier 1] Unexpected Thread Error in {source_name}: {str(e)}")
            return RawSignal(
                source=source_name,
                status="failed",
                failure_reason=f"Unexpected: {str(e)}",
                latency_ms=0,
                tier=1,
            )

    tasks = [
        _safe_execute(_ocr_signal, p_path, ocr_langs, source_name="vision_ocr"),
        _safe_execute(_web_signal, o_path, source_name="vision_web"),
        _safe_execute(_logo_signal, p_path, source_name="vision_logo"),
    ]

    if not skip_landmark:
        tasks.append(_safe_execute(_landmark_signal, p_path, source_name="vision_landmark"))
    else:
        logger.info("[Tier 1] Skipping 'vision_landmark' (Already checked in Tier 0).")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    final_signals: list[RawSignal] = []
    for res in results:
        if isinstance(res, RawSignal):
            if res.status == "failed":
                logger.warning(f"[Tier 1] Partial failure on {res.source}: {res.failure_reason}")
            final_signals.append(res)
            if res.source == "vision_web" and res.status == "resolved" and isinstance(res.raw_response, dict):
                if res.raw_response.get("from") not in ("web_entity", "page_title"):
                    final_signals.extend(_web_extra_signals(res.raw_response))
        else:
            logger.critical(f"[Tier 1] Critical System Crash during gather: {str(res)}")

    return final_signals