from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.services.search.candidate_normalizer_service import (
    normalize_signals_to_candidates,
)
from app.services.search.candidate_scorer_service import (
    compute_verdict,
    score_and_rank,
)
from app.services.search.contracts import (
    SearchHintContext,
    SearchImageAnalysis,
)
from app.services.search.exif_gps_resolver_service import resolve_from_exif_gps
from app.services.search.get_main_engine_service import analyze_gpt_main_voter
from app.services.search.gpt_arbiter_service import run_gpt_arbiter
from app.services.search.tier1_collector_service import collect_tier1_signals
from app.services.shared.exif_service import extract_image_metadata
from app.services.shared.image_preprocessing_service import preprocess_image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tier-level outer timeouts. Every inner helper already has its own per-call
# timeout (tier1_collector 4.5s per task, GPT main 10s, GPT arbiter 12s).
# These are an OUTER safety net so the request can never hang on one slow
# tier — if a tier exceeds its budget we fall back to best-so-far candidates.
# ---------------------------------------------------------------------------
TIER0_TIMEOUT_SEC = 8.0
TIER1_TIMEOUT_SEC = 10.0   # collector's 4.5s + normalize+score headroom
TIER2_TIMEOUT_SEC = 13.0   # GPT main 10s + parse/normalize headroom
TIER3_TIMEOUT_SEC = 14.0   # GPT arbiter 12s + headroom

STOPPING_VERDICTS_TIER1 = {"confident"}
STOPPING_VERDICTS_TIER2 = {"confident", "likely"}


async def _run_with_timeout(coro, *, timeout: float, label: str, fallback):
    """Tier-level outer timeout. Any timeout/exception swallows into fallback
    so a single misbehaving tier never deadlocks the whole request."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.error(f"[{label}] outer timeout after {timeout}s")
        return fallback
    except Exception as exc:
        logger.error(f"[{label}] outer error: {exc}")
        return fallback


def _signals_to_dicts(signals_or_dicts: list[Any]) -> list[dict[str, Any]]:
    """tier1_collector returns RawSignal objects, other tiers return dicts.
    Normalize once here so downstream code only deals with dicts."""
    out: list[dict[str, Any]] = []
    for item in signals_or_dicts:
        if hasattr(item, "to_dict"):
            out.append(item.to_dict())
        elif isinstance(item, dict):
            out.append(item)
    return out


def _extract_ocr_text(signals: list[dict[str, Any]]) -> str | None:
    """Pull OCR text out of the collected signals so GPT (Method A) can see
    the raw evidence — not OCR's verdict — when voting independently."""
    for signal in signals:
        if signal.get("source") == "vision_ocr" and signal.get("status") == "resolved":
            return signal.get("parsed_place_name")
    return None


def _extract_exif_clues(metadata: dict[str, Any]) -> dict[str, Any]:
    camera = metadata.get("camera") or {}
    return {
        "captured_at": metadata.get("captured_at"),
        "camera_make": camera.get("make"),
        "camera_model": camera.get("model"),
    }


def _build_analysis(metadata: dict[str, Any], *, hints: SearchHintContext) -> SearchImageAnalysis:
    return SearchImageAnalysis(
        file_name=metadata.get("file_name") or "upload.bin",
        absolute_path=metadata.get("absolute_path"),
        file_size_bytes=int(metadata.get("file_size_bytes") or 0),
        image=metadata.get("image") or {},
        captured_at=metadata.get("captured_at"),
        camera=metadata.get("camera") or {},
        gps=metadata.get("gps"),
        has_gps=bool(metadata.get("gps")),
        metadata_case="gps_present" if metadata.get("gps") else "gps_missing",
        exif_summary=metadata.get("exif_summary") or {},
        hint_context={
            "country_hint": hints.normalized_country(),
            "city_hint": hints.normalized_city(),
            "user_hint": hints.normalized_user_hint(),
        },
    )


def _apply_top_candidate(analysis: SearchImageAnalysis, verdict: str) -> None:
    """Project the rank-1 candidate onto the legacy resolved_* fields so any
    existing frontend code that reads them still gets a sensible shape."""
    if not analysis.candidates:
        analysis.resolution_status = "failed"
        analysis.resolution_source = "tiered_fusion"
        analysis.resolved_location = None
        analysis.city = "Unknown Location"
        analysis.failure_reason = "No candidates produced by any tier."
        return

    top = analysis.candidates[0]
    analysis.resolution_status = (
        "resolved" if verdict in {"confident", "likely"} else "suggestions"
    )
    analysis.resolution_source = "tiered_fusion"
    analysis.resolved_location = {
        "status": analysis.resolution_status,
        "source": "tiered_fusion",
        "latitude": top.get("latitude"),
        "longitude": top.get("longitude"),
        "formatted_address": top.get("formatted_address"),
        "country": top.get("country"),
        "city": top.get("city"),
        "region": None,
        "place_name": top.get("place_name"),
        "metadata": {
            "contributing_sources": top.get("contributing_sources"),
            "aggregated_score": top.get("aggregated_score"),
            "verdict": verdict,
        },
        "failure_reason": None,
    }
    analysis.city = top.get("city") or "Unknown Location"


async def _tier1_pipeline(
    processed_path: Path,
    original_path: Path,
    *,
    hints: SearchHintContext,
    skip_landmark: bool,
    prior_signals: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    raw = await collect_tier1_signals(
        processed_path,
        original_path,
        hints=hints,
        skip_landmark=skip_landmark,
    )
    tier1_dicts = _signals_to_dicts(raw)
    candidates = await normalize_signals_to_candidates(
        prior_signals + tier1_dicts, hints=hints
    )
    scored, _ = score_and_rank(candidates)
    reweighted, verdict = _apply_hint_reweight(scored, hints=hints)

    if reweighted and verdict != "confident":
        if _has_web_exact_match(tier1_dicts) and reweighted[0].get("country") and reweighted[0].get("city"):
            promoted = [dict(reweighted[0])]
            promoted[0]["aggregated_score"] = max(promoted[0].get("aggregated_score") or 0.0, 0.92)
            promoted[0]["rank"] = 1
            for idx, c in enumerate(reweighted[1:], start=2):
                clone = dict(c)
                clone["rank"] = idx
                promoted.append(clone)
            return tier1_dicts, promoted, "confident"

    return tier1_dicts, reweighted, verdict


def _has_web_exact_match(signals: list[dict[str, Any]]) -> bool:
    for s in signals:
        if s.get("source") != "vision_web" or s.get("status") != "resolved":
            continue
        raw = s.get("raw_response") or {}
        if not isinstance(raw, dict):
            continue
        if int(raw.get("full_matching_images_count") or 0) > 0:
            return True
    return False


async def _extract_vision_labels(original_path: Path) -> list[str]:
    """Pull visual content labels (Bridge, Mountain, Beach, etc.) so GPT
    can be constrained to candidates matching what's actually in the image."""
    try:
        from app.services.shared.label_detection_service import analyze_label_detection
        result = await asyncio.to_thread(analyze_label_detection, original_path, 10)
        labels = result.get("labels") or []
        return [
            (label.get("description") or "").strip()
            for label in labels
            if (label.get("score") or 0) >= 0.6 and label.get("description")
        ][:8]
    except Exception as exc:
        logger.warning(f"[Tier 2] Label detection failed (continuing without): {exc}")
        return []


async def _tier2_pipeline(
    original_path: Path,
    *,
    hints: SearchHintContext,
    ocr_text: str | None,
    exif_clues: dict[str, Any],
    prior_signals: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    vision_labels = await _extract_vision_labels(original_path)
    if vision_labels:
        logger.info(f"[Tier 2] Visual labels for GPT constraint: {vision_labels}")
    main_result = await analyze_gpt_main_voter(
        original_path, ocr_text, exif_clues, hints=hints, vision_labels=vision_labels
    )
    gpt_signals: list[dict[str, Any]] = []
    for item in main_result or []:
        signal = item.get("signal") if isinstance(item, dict) else None
        if isinstance(signal, dict):
            gpt_signals.append(signal)

    if not gpt_signals:
        return [], [], "failed"

    combined = prior_signals + gpt_signals
    candidates = await normalize_signals_to_candidates(combined, hints=hints)
    scored, _ = score_and_rank(candidates)
    reweighted, verdict = _apply_hint_reweight(scored, hints=hints)
    return gpt_signals, reweighted, verdict


HINT_COUNTRY_MATCH_MULTIPLIER = 1.30
HINT_COUNTRY_MISMATCH_MULTIPLIER = 0.40
HINT_CITY_MATCH_MULTIPLIER = 1.20
HINT_CITY_MISMATCH_MULTIPLIER = 0.50


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _apply_hint_reweight(
    candidates: list[dict[str, Any]],
    *,
    hints: SearchHintContext,
) -> tuple[list[dict[str, Any]], str]:
    """Multiply each candidate's score by country/city hint match factors,
    re-sort, re-rank, and recompute the verdict. No-op when no hints."""
    if not candidates:
        return candidates, "failed"

    country_hint = _norm(hints.normalized_country())
    city_hint = _norm(hints.normalized_city())
    if not country_hint and not city_hint:
        # Nothing to reweight — but still recompute verdict for a current view.
        return candidates, compute_verdict(candidates)

    reweighted: list[dict[str, Any]] = []
    for candidate in candidates:
        score = candidate.get("aggregated_score") or 0.0
        multiplier = 1.0
        notes: list[str] = []

        if country_hint:
            cand_country = _norm(candidate.get("country"))
            if cand_country and cand_country == country_hint:
                multiplier *= HINT_COUNTRY_MATCH_MULTIPLIER
                notes.append("country hint matched")
            elif cand_country:
                # Only penalize if we KNOW the candidate's country and it
                # differs — silence shouldn't be punished as mismatch.
                multiplier *= HINT_COUNTRY_MISMATCH_MULTIPLIER
                notes.append("country hint mismatch")

        if city_hint:
            cand_city = _norm(candidate.get("city"))
            if cand_city and cand_city == city_hint:
                multiplier *= HINT_CITY_MATCH_MULTIPLIER
                notes.append("city hint matched")
            elif cand_city:
                multiplier *= HINT_CITY_MISMATCH_MULTIPLIER
                notes.append("city hint mismatch")

        new_score = min(score * multiplier, 1.0)
        new_candidate = {**candidate, "aggregated_score": round(new_score, 4)}
        if notes:
            existing = new_candidate.get("reasoning") or ""
            tag = " · ".join(notes)
            new_candidate["reasoning"] = (
                f"{existing} · {tag}" if existing else tag
            )
        reweighted.append(new_candidate)

    reweighted.sort(key=lambda c: c.get("aggregated_score") or 0.0, reverse=True)
    for index, candidate in enumerate(reweighted, start=1):
        candidate["rank"] = index

    return reweighted, compute_verdict(reweighted)


async def analyze_uploaded_search_image(
    file: UploadFile,
    *,
    country_hint: str | None = None,
    city_hint: str | None = None,
    user_hint: str | None = None,
    language: str = "en",
    force_openai_retry: bool = False,  # cascade-era no-op kept for compat
    db: Session | None = None,         # accepted for callers that pass it
) -> SearchImageAnalysis:
    """Tiered signal-fusion search.

    Flow (each tier wrapped in an outer timeout; best-so-far on failure):
      Tier 0 — EXIF GPS shortcut. If GPS resolves cleanly, stop.
      Tier 1 — OCR + Landmark + Web + Logo in parallel; if a strong
               consensus forms (verdict=confident), stop.
      Tier 2 — GPT main engine (Method A, independent voter). Sees the
               image + OCR text + EXIF clues, NOT other APIs' verdicts.
               Adds its candidates as gpt4o_main signals, then rescore.
               Stop if verdict in {confident, likely}.
      Tier 3 — GPT arbiter (Method B, judge). Sees all signals and
               re-ranks existing candidates only — no new vote, no
               double counting. Returns whatever verdict the new order
               produces.
    """
    del force_openai_retry, db  # not used in fusion flow

    suffix = Path(file.filename or "upload.bin").suffix
    hints = SearchHintContext(country_hint=country_hint, city_hint=city_hint, user_hint=user_hint, language=language)

    upload_path: Path | None = None
    processed_path: Path | None = None
    started = time.perf_counter()

    combined_signals: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    verdict: str = "failed"
    tier_trace: list[dict[str, Any]] = []
    tier_reached: int = 0

    try:
        # ---- Save upload to disk (helpers need a path) ----
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            upload_path = Path(tmp.name)

        # ---- Layer 1: preprocess (dual path) ----
        try:
            preprocessing = preprocess_image(upload_path)
        except Exception as exc:
            logger.error(f"preprocessing failed: {exc}")
            preprocessing = {
                "original_path": str(upload_path),
                "processed_path": str(upload_path),
                "applied": [],
                "error": str(exc),
            }
        original_path = Path(preprocessing["original_path"])
        processed_path = Path(preprocessing["processed_path"])

        # ---- Layer 1: EXIF extract ----
        try:
            metadata = extract_image_metadata(upload_path)
        except Exception as exc:
            logger.error(f"EXIF extraction failed: {exc}")
            metadata = {
                "file_size_bytes": 0,
                "image": {},
                "camera": {},
                "gps": None,
                "exif_summary": {},
                "captured_at": None,
            }
        metadata["file_name"] = file.filename or metadata.get("file_name") or "upload.bin"

        analysis = _build_analysis(metadata, hints=hints)
        analysis.preprocessing = preprocessing

        # ---------------- Tier 0 ----------------
        tier0_did_landmark = False
        if analysis.has_gps and analysis.gps:
            t0 = await _run_with_timeout(
                resolve_from_exif_gps(original_path, gps=analysis.gps, hints=hints),
                timeout=TIER0_TIMEOUT_SEC,
                label="Tier 0",
                fallback=None,
            )
            if t0 is not None:
                tier_trace.append(t0.to_dict() if hasattr(t0, "to_dict") else {})
                combined_signals.extend(t0.signals)
                tier0_did_landmark = any(
                    s.get("source") == "vision_landmark" for s in t0.signals
                )
                if t0.stop_here:
                    analysis.signals = combined_signals
                    analysis.candidates = t0.candidates
                    analysis.verdict = t0.verdict or "failed"
                    analysis.tier_reached = 0
                    analysis.tier_trace = tier_trace
                    _apply_top_candidate(analysis, analysis.verdict)
                    return analysis

        # ---------------- Tier 1 ----------------
        tier1_result = await _run_with_timeout(
            _tier1_pipeline(
                processed_path,
                original_path,
                hints=hints,
                skip_landmark=tier0_did_landmark,
                prior_signals=combined_signals,
            ),
            timeout=TIER1_TIMEOUT_SEC,
            label="Tier 1",
            fallback=None,
        )
        if tier1_result is not None:
            tier1_signals, candidates, verdict = tier1_result
            combined_signals.extend(tier1_signals)
            tier_reached = 1
            tier_trace.append(
                {
                    "tier": 1,
                    "name": "tier1_collector",
                    "verdict": verdict,
                    "signal_count": len(tier1_signals),
                    "candidate_count": len(candidates),
                }
            )
            if verdict in STOPPING_VERDICTS_TIER1:
                analysis.signals = combined_signals
                analysis.candidates = candidates
                analysis.verdict = verdict
                analysis.tier_reached = 1
                analysis.tier_trace = tier_trace
                _apply_top_candidate(analysis, verdict)
                return analysis

        # ---------------- Tier 2 (GPT main engine, Method A) ----------------
        ocr_text = _extract_ocr_text(combined_signals)
        exif_clues = _extract_exif_clues(metadata)

        tier2_result = await _run_with_timeout(
            _tier2_pipeline(
                original_path,
                hints=hints,
                ocr_text=ocr_text,
                exif_clues=exif_clues,
                prior_signals=combined_signals,
            ),
            timeout=TIER2_TIMEOUT_SEC,
            label="Tier 2",
            fallback=None,
        )
        if tier2_result is not None:
            gpt_signals, new_candidates, new_verdict = tier2_result
            if gpt_signals:
                combined_signals.extend(gpt_signals)
                candidates = new_candidates
                verdict = new_verdict
                tier_reached = 2
                tier_trace.append(
                    {
                        "tier": 2,
                        "name": "gpt_main_engine",
                        "verdict": verdict,
                        "signal_count": len(gpt_signals),
                        "candidate_count": len(candidates),
                    }
                )

        if verdict in STOPPING_VERDICTS_TIER2:
            analysis.signals = combined_signals
            analysis.candidates = candidates
            analysis.verdict = verdict
            analysis.tier_reached = tier_reached
            analysis.tier_trace = tier_trace
            _apply_top_candidate(analysis, verdict)
            return analysis

        # ---------------- Tier 3 (GPT arbiter, Method B re-rank only) ----------------
        if candidates:
            reranked = await _run_with_timeout(
                run_gpt_arbiter(original_path, candidates),
                timeout=TIER3_TIMEOUT_SEC,
                label="Tier 3",
                fallback=candidates,
            )
            candidates = reranked or candidates
            verdict = compute_verdict(candidates)
            tier_reached = 3
            tier_trace.append(
                {
                    "tier": 3,
                    "name": "gpt_arbiter",
                    "verdict": verdict,
                    "candidate_count": len(candidates),
                }
            )

        analysis.signals = combined_signals
        analysis.candidates = candidates
        analysis.verdict = verdict
        analysis.tier_reached = tier_reached
        analysis.tier_trace = tier_trace
        _apply_top_candidate(analysis, verdict)
        return analysis

    finally:
        # Clean up temp files. processed_path equals upload_path when no
        # preprocessing transform was applied — guard against double-unlink.
        elapsed = round(time.perf_counter() - started, 2)
        logger.info(f"search completed in {elapsed}s, tier_reached={tier_reached}, verdict={verdict}")
        try:
            if upload_path and upload_path.exists():
                upload_path.unlink(missing_ok=True)
        except Exception:
            pass
        try:
            if (
                processed_path
                and processed_path != upload_path
                and processed_path.exists()
            ):
                processed_path.unlink(missing_ok=True)
        except Exception:
            pass
