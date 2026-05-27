from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

from app.services.search.contracts import (
    Candidate,
    RawSignal,
    SearchHintContext,
    TierResult,
)
from app.services.shared.geocoding_service import reverse_geocode_coordinates
from app.services.shared.places_service import enrich_coordinates_with_place_context


def _normalize_country(value: str | None) -> str:
    return (value or "").strip().lower()


def _gps_signal(gps: dict[str, Any]) -> RawSignal:
    return RawSignal(
        source="exif_gps",
        status="resolved",
        raw_response={"gps": gps},
        parsed_latitude=float(gps["latitude"]),
        parsed_longitude=float(gps["longitude"]),
        signal_score=1.0,
        tier=0,
    )


async def _run_place_lookup(latitude: float, longitude: float) -> dict | None:
    """Reverse geocode + nearby POI in one go (uses places_service helper).
    If the combined call fails, fall back to plain reverse_geocode."""
    try:
        return await asyncio.to_thread(
            enrich_coordinates_with_place_context, latitude, longitude
        )
    except Exception:
        try:
            return await asyncio.to_thread(
                reverse_geocode_coordinates, latitude, longitude
            )
        except Exception:
            return None


async def resolve_from_exif_gps(
    original_path: str | Path,
    *,
    gps: dict[str, Any],
    hints: SearchHintContext,  # accepted but Tier 0 doesn't reweight by hints
) -> TierResult:
    """Tier 0 — EXIF GPS shortcut.

    Steps:
      1. Reverse-geocode the GPS coords + fetch a nearby POI for a richer
         place name (e.g., "Sensō-ji" instead of "2-3-1 Asakusa").

    Verdict:
      - confident : GPS resolved
      - likely    : GPS coords kept but reverse-geocoding failed
    """
    del hints  # reserved for future use (e.g., user-hint country override)

    if (
        not gps
        or gps.get("latitude") is None
        or gps.get("longitude") is None
    ):
        return TierResult(
            tier=0,
            name="exif_gps_resolver",
            signals=[],
            candidates=[],
            verdict="inconclusive",
            stop_here=False,
            notes=["gps_missing_or_incomplete"],
        )

    started = time.perf_counter()
    signals: list[RawSignal] = [_gps_signal(gps)]
    notes: list[str] = []

    lat = float(gps["latitude"])
    lng = float(gps["longitude"])

    place_ctx = await _run_place_lookup(lat, lng)

    if not place_ctx:
        candidate = Candidate(
            rank=1,
            place_name=None,
            latitude=lat,
            longitude=lng,
            # GPS coords alone are very high confidence even without geocoded
            # context — that's the whole point of the Tier 0 shortcut.
            aggregated_score=0.95,
            contributing_sources=["exif_gps"],
            reasoning="GPS coords accepted; reverse geocoding unavailable.",
        )
        return TierResult(
            tier=0,
            name="exif_gps_resolver",
            signals=[s.to_dict() for s in signals],
            candidates=[candidate.to_dict()],
            verdict="likely",
            stop_here=True,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            notes=["place_lookup_failed"],
        )

    geocoded_country = place_ctx.get("country")
    geocoded_city = place_ctx.get("city")
    formatted_address = place_ctx.get("formatted_address")
    top_poi = place_ctx.get("top_poi") or {}
    poi_name = top_poi.get("name") if top_poi else None
    place_id = top_poi.get("id") or place_ctx.get("address_place_id")

    contributing = ["exif_gps"]

    candidate = Candidate(
        rank=1,
        place_name=poi_name or formatted_address,
        formatted_address=formatted_address,
        country=geocoded_country,
        city=geocoded_city,
        latitude=lat,
        longitude=lng,
        google_place_id=place_id,
        # Tier 0 GPS-resolved candidate is "confident" by construction — give
        # it a near-perfect score so the UI displays a real match percentage
        # instead of 0% (which happens when aggregated_score is left None).
        aggregated_score=1.0,
        contributing_sources=contributing,
        reasoning="EXIF GPS coords resolved via Geocoding/Places.",
    )

    return TierResult(
        tier=0,
        name="exif_gps_resolver",
        signals=[s.to_dict() for s in signals],
        candidates=[candidate.to_dict()],
        verdict="confident",
        stop_here=True,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
        notes=notes,
    )
