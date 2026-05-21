from __future__ import annotations

import asyncio
from typing import Any

from app.services.shared.geocoding_service import geocode_address, reverse_geocode_coordinates

# Signals that describe broad scene type, not a place. They contribute to
# scoring (as evidence the place type matches) but don't generate candidates.
SCENE_ONLY_SOURCES: set[str] = {"vision_label", "vision_object", "clip_scene"}

# Round coords this many decimal places to bucket "nearby" candidates.
# 2 decimals ≈ 1km — close enough that different APIs pointing at the same
# landmark cluster together.
GEO_BUCKET_DECIMALS = 2


def _normalize_one_signal(signal: dict[str, Any]) -> dict[str, Any] | None:
    """Turn one raw signal into a mini-candidate by resolving it to a real
    place via Places/Geocoding. Returns None if the signal has nothing to
    geocode or the lookup fails."""

    try:
        lat = signal.get("parsed_latitude")
        lng = signal.get("parsed_longitude")
        if lat is not None and lng is not None:
            geo = reverse_geocode_coordinates(float(lat), float(lng))
        else:
            text = (signal.get("parsed_place_name") or "").strip()
            if len(text) < 3:
                return None
            geo = geocode_address(text)
    except Exception:
        return None

    return {
        "source": signal["source"],
        "signal_score": signal.get("signal_score"),
        "place_id": geo.get("place_id"),
        "place_name": signal.get("parsed_place_name") or geo.get("formatted_address"),
        "formatted_address": geo.get("formatted_address"),
        "country": geo.get("country"),
        "city": geo.get("city"),
        "latitude": geo.get("latitude"),
        "longitude": geo.get("longitude"),
    }


def _group_key(mini: dict[str, Any]) -> str:
    place_id = mini.get("place_id")
    if place_id:
        return f"pid:{place_id}"

    lat = mini.get("latitude")
    lng = mini.get("longitude")
    if lat is not None and lng is not None:
        return f"geo:{round(float(lat), GEO_BUCKET_DECIMALS)},{round(float(lng), GEO_BUCKET_DECIMALS)}"

    return f"name:{(mini.get('place_name') or '').strip().lower()}"


def _group_into_candidates(minis: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for mini in minis:
        groups.setdefault(_group_key(mini), []).append(mini)

    candidates: list[dict[str, Any]] = []
    for members in groups.values():
        # Representative = member with the highest signal_score (None treated as 0).
        best = max(members, key=lambda m: (m.get("signal_score") or 0))
        candidates.append(
            {
                "place_name": best.get("place_name"),
                "formatted_address": best.get("formatted_address"),
                "country": best.get("country"),
                "city": best.get("city"),
                "latitude": best.get("latitude"),
                "longitude": best.get("longitude"),
                "google_place_id": best.get("place_id"),
                # Sources whose normalization landed in this group (for the scorer).
                "contributing_sources": [m["source"] for m in members],
                # Keep per-source signal scores so the scorer can weight them.
                "member_signal_scores": [
                    {"source": m["source"], "score": m.get("signal_score")}
                    for m in members
                ],
            }
        )

    return candidates


async def normalize_signals_to_candidates(
    signals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Layer 4 entry point: parallel-geocode each location-bearing signal,
    then merge signals that resolve to the same place into one candidate."""

    eligible = [
        signal
        for signal in signals
        if signal.get("status") == "resolved"
        and signal.get("source") not in SCENE_ONLY_SOURCES
        and (
            signal.get("parsed_place_name")
            or (signal.get("parsed_latitude") is not None and signal.get("parsed_longitude") is not None)
        )
    ]
    if not eligible:
        return []

    tasks = [asyncio.to_thread(_normalize_one_signal, signal) for signal in eligible]
    results = await asyncio.gather(*tasks)
    minis = [item for item in results if item is not None]

    return _group_into_candidates(minis)
