from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.search import (
    AnalysisSignal,
    ImageAnalysisRun,
    LocationCandidate,
    SearchSession,
)
from app.services.search.contracts import SearchHintContext, SearchImageAnalysis


def create_search_session(
    db: Session,
    *,
    hints: SearchHintContext,
    user_id: int | None = None,
) -> SearchSession:
    """Create the search session first so the uploaded image and analysis
    run can link back to it."""

    session = SearchSession(
        user_id=user_id,
        hint_country=hints.normalized_country(),
        hint_city=hints.normalized_city(),
        hint_region=None,
        user_hint_text=hints.normalized_user_hint(),
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _first(payload: dict[str, Any] | None, *keys: str) -> Any:
    if not payload:
        return None
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return None


def _coordinate_type(resolved_source: str | None, has_location: bool) -> str:
    if resolved_source == "exif_gps":
        return "metadata_gps"
    if has_location:
        return "inferred_gps"
    return "none"


def _verdict(resolved_source: str | None, has_location: bool) -> str:
    if not has_location:
        return "failed"
    if resolved_source == "exif_gps":
        return "confident"
    return "likely"


def _build_signals(analysis: SearchImageAnalysis) -> list[AnalysisSignal]:
    signals: list[AnalysisSignal] = []

    if analysis.clip_gate:
        passed = bool(analysis.clip_gate.get("is_location_candidate"))
        signals.append(
            AnalysisSignal(
                source="clip_gate",
                status="resolved" if passed else "rejected",
                raw_response=analysis.clip_gate,
            )
        )

    if analysis.clip_scene_hints:
        signals.append(
            AnalysisSignal(
                source="clip_scene",
                status="resolved",
                raw_response={"hints": analysis.clip_scene_hints},
            )
        )

    if analysis.landmark_candidate:
        signals.append(
            AnalysisSignal(
                source="vision_landmark",
                status="resolved",
                raw_response=analysis.landmark_candidate,
                parsed_place_name=_first(
                    analysis.landmark_candidate, "name", "place_name"
                ),
                parsed_latitude=_first(analysis.landmark_candidate, "latitude", "lat"),
                parsed_longitude=_first(
                    analysis.landmark_candidate, "longitude", "lng", "lon"
                ),
            )
        )

    if analysis.openai_candidate:
        signals.append(
            AnalysisSignal(
                source="gpt4o_vision",
                status="resolved",
                raw_response=analysis.openai_candidate,
                parsed_place_name=_first(
                    analysis.openai_candidate, "place_name", "name"
                ),
                parsed_country=_first(analysis.openai_candidate, "country"),
                parsed_city=_first(analysis.openai_candidate, "city"),
            )
        )

    return signals


def _signal_rows_from_fusion(signals: list[dict[str, Any]]) -> list[AnalysisSignal]:
    return [
        AnalysisSignal(
            source=signal["source"],
            status=signal.get("status", "unknown"),
            raw_response=signal.get("raw_response"),
            parsed_place_name=signal.get("parsed_place_name"),
            parsed_country=signal.get("parsed_country"),
            parsed_city=signal.get("parsed_city"),
            parsed_latitude=signal.get("parsed_latitude"),
            parsed_longitude=signal.get("parsed_longitude"),
            signal_score=signal.get("signal_score"),
            failure_reason=signal.get("failure_reason"),
        )
        for signal in signals
    ]


def _candidate_rows_from_fusion(candidates: list[dict[str, Any]]) -> list[LocationCandidate]:
    return [
        LocationCandidate(
            rank=candidate.get("rank") or (index + 1),
            place_name=candidate.get("place_name"),
            formatted_address=candidate.get("formatted_address"),
            country=candidate.get("country"),
            city=candidate.get("city"),
            latitude=candidate.get("latitude"),
            longitude=candidate.get("longitude"),
            google_place_id=candidate.get("google_place_id"),
            aggregated_score=candidate.get("aggregated_score"),
            contributing_sources=candidate.get("contributing_sources"),
            reasoning=candidate.get("reasoning"),
            is_selected=False,
        )
        for index, candidate in enumerate(candidates)
    ]


def persist_analysis_run(
    db: Session,
    *,
    analysis: SearchImageAnalysis,
    image_id: int,
    search_session_id: int | None,
    hint_round: int = 0,
) -> ImageAnalysisRun:
    """Write one analysis attempt: the run + N signals + N candidates.
    Fusion path uses analysis.signals / analysis.candidates directly.
    The legacy cascade branch (analysis.signals empty) is kept as a safety
    net during the transition and can be removed once no caller relies on it."""

    resolved = analysis.resolved_location or {}
    has_location = analysis.resolution_status == "resolved" and bool(resolved)
    source = analysis.resolution_source

    run = ImageAnalysisRun(
        image_id=image_id,
        search_session_id=search_session_id,
        hint_round=hint_round,
        status=analysis.resolution_status,
        verdict=analysis.verdict or _verdict(source, has_location),
        resolved_source=source,
        coordinate_type=_coordinate_type(source, has_location),
        has_resolved_location=has_location,
        resolved_place_name=resolved.get("place_name"),
        resolved_formatted_address=resolved.get("formatted_address"),
        resolved_country=resolved.get("country"),
        resolved_city=resolved.get("city"),
        resolved_latitude=resolved.get("latitude"),
        resolved_longitude=resolved.get("longitude"),
        clip_gate=analysis.clip_gate,
        clip_summary=analysis.summary if isinstance(analysis.summary, str) else None,
        failure_reason=analysis.failure_reason,
        completed_at=datetime.now(timezone.utc),
    )

    if analysis.signals:
        run.signals = _signal_rows_from_fusion(analysis.signals)
    else:
        run.signals = _build_signals(analysis)  # legacy cascade fallback

    if analysis.candidates:
        run.candidates = _candidate_rows_from_fusion(analysis.candidates)
    elif has_location:
        run.candidates = [
            LocationCandidate(
                rank=1,
                place_name=resolved.get("place_name"),
                formatted_address=resolved.get("formatted_address"),
                country=resolved.get("country"),
                city=resolved.get("city"),
                latitude=resolved.get("latitude"),
                longitude=resolved.get("longitude"),
                contributing_sources=[source] if source else None,
                is_selected=False,
            )
        ]

    db.add(run)
    db.commit()
    db.refresh(run)
    return run
