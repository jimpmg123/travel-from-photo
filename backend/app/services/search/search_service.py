from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.repositories.search_repository import create_search_session, persist_analysis_run
from app.services.search.candidate_normalizer_service import normalize_signals_to_candidates
from app.services.search.candidate_scorer_service import score_and_rank
from app.services.search.contracts import (
    SearchHintContext,
    SearchImageAnalysis,
    SearchLocationResolution,
)
from app.services.search.hint_reweighting_service import reweight_candidates
from app.services.search.image_ingestion_service import extract_image_metadata_payload
from app.services.search.signal_collector_service import build_exif_gps_signal, collect_signals
from app.services.shared.image_preprocessing_service import preprocess_image


def _build_analysis_from_metadata(metadata: dict, *, hints: SearchHintContext) -> SearchImageAnalysis:
    return SearchImageAnalysis(
        file_name=metadata["file_name"],
        absolute_path=metadata.get("absolute_path"),
        file_size_bytes=metadata["file_size_bytes"],
        image=metadata.get("image") or {},
        captured_at=metadata.get("captured_at"),
        camera=metadata.get("camera") or {},
        gps=metadata.get("gps"),
        has_gps=bool(metadata.get("gps")),
        metadata_case=str(
            metadata.get("metadata_case") or ("gps_present" if metadata.get("gps") else "gps_missing")
        ),
        exif_summary=metadata.get("exif_summary") or {},
        hint_context={
            "country_hint": hints.normalized_country(),
            "city_hint": hints.normalized_city(),
            "user_hint": hints.normalized_user_hint(),
        },
    )


def _apply_top_candidate(analysis: SearchImageAnalysis, verdict: str) -> None:
    """Project the rank-1 candidate onto the legacy resolution fields so
    older frontend code (which reads resolved_*, city, etc.) keeps working
    while we also publish the new signals/candidates/verdict."""

    if not analysis.candidates:
        analysis.apply_resolution(
            SearchLocationResolution(
                status="failed",
                source="signal_fusion",
                latitude=None,
                longitude=None,
                formatted_address=None,
                country=None,
                city=None,
                region=None,
                failure_reason="No candidates produced from any signal.",
            )
        )
        analysis.city = "Unknown Location"
        return

    top = analysis.candidates[0]
    status = "resolved" if verdict in {"confident", "likely"} else "suggestions"
    analysis.apply_resolution(
        SearchLocationResolution(
            status=status,
            source="signal_fusion",
            latitude=top.get("latitude"),
            longitude=top.get("longitude"),
            formatted_address=top.get("formatted_address"),
            country=top.get("country"),
            city=top.get("city"),
            region=None,
            place_name=top.get("place_name"),
            metadata={
                "contributing_sources": top.get("contributing_sources"),
                "aggregated_score": top.get("aggregated_score"),
                "verdict": verdict,
            },
        )
    )
    analysis.city = top.get("city") or "Unknown Location"


async def analyze_uploaded_search_image(
    file: UploadFile,
    *,
    country_hint: str | None = None,
    city_hint: str | None = None,
    user_hint: str | None = None,
    force_openai_retry: bool = False,  # accepted for backward compat; fusion always runs all signals
    db: Session | None = None,
    user_id: int | None = None,
) -> SearchImageAnalysis:
    """Signal fusion flow:
    1. Persist upload (UploadedImage + ImageExifMetadata) and start a SearchSession.
    2. Preprocess the image (rotation, resize, autocontrast).
    3. Build the EXIF GPS signal if present, then fan out 7 external signals in parallel.
    4. Normalize signals into candidates via Places/Geocoding.
    5. Score per-source priors and compute the verdict.
    6. Re-weight by user hints (country/city/text), re-rank, recompute verdict.
    7. Persist the run + N signals + N candidates."""

    del force_openai_retry  # cascade-era param; fusion ignores it

    suffix = Path(file.filename or "upload.bin").suffix
    hints = SearchHintContext(country_hint=country_hint, city_hint=city_hint, user_hint=user_hint)
    temp_path: Path | None = None
    processed_path: Path | None = None

    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        session = create_search_session(db, hints=hints, user_id=user_id) if db else None
        session_id = session.id if session else None

        metadata = extract_image_metadata_payload(
            temp_path,
            include_path=False,
            db=db,
            user_id=user_id,
            search_session_id=session_id,
        )
        metadata["file_name"] = file.filename or metadata["file_name"]
        analysis = _build_analysis_from_metadata(metadata, hints=hints)

        try:
            preprocess_result = preprocess_image(temp_path)
            analysis.preprocessing = preprocess_result
            processed_path = Path(preprocess_result["processed_path"])
        except Exception as exc:
            analysis.preprocessing = {"applied": [], "error": str(exc)}
            processed_path = temp_path

        exif_signal = build_exif_gps_signal(analysis.gps)
        external_signals = await collect_signals(processed_path, hints=hints, user_hint=user_hint)
        analysis.signals = ([exif_signal] if exif_signal else []) + list(external_signals)

        candidates = await normalize_signals_to_candidates(analysis.signals)
        scored, _ = score_and_rank(candidates)
        final, verdict = reweight_candidates(scored, hints=hints, same_session_gps_cluster=None)
        analysis.candidates = final
        analysis.verdict = verdict

        _apply_top_candidate(analysis, verdict)

        if db is not None and metadata.get("database_id") is not None:
            try:
                persist_analysis_run(
                    db,
                    analysis=analysis,
                    image_id=metadata["database_id"],
                    search_session_id=session_id,
                )
            except Exception:
                db.rollback()  # search must still return even if persistence fails

        return analysis
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)
        if processed_path and processed_path != temp_path and processed_path.exists():
            processed_path.unlink(missing_ok=True)
