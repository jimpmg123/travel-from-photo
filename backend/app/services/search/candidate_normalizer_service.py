from __future__ import annotations

import asyncio
from typing import Any

from app.services.search.contracts import Candidate, SearchHintContext
from app.services.shared.geocoding_service import (
    geocode_address,
    reverse_geocode_coordinates,
)

# Signals that describe broad scene type, not a place — they don't get
# normalized into candidates (but still contribute to scoring later if
# we want to give scene-type bonuses).
SCENE_ONLY_SOURCES: set[str] = {"vision_label", "vision_object", "clip_scene"}

# Round coords this many decimals to bucket "nearby" results
# (2 decimals ≈ 1km — close enough that different APIs pointing at the
# same landmark land in the same bucket).
GEO_BUCKET_DECIMALS = 2


def _is_eligible(signal: dict[str, Any]) -> bool:
    if signal.get("status") != "resolved":
        return False
    if signal.get("source") in SCENE_ONLY_SOURCES:
        return False
    has_coords = (
        signal.get("parsed_latitude") is not None
        and signal.get("parsed_longitude") is not None
    )
    has_text = bool((signal.get("parsed_place_name") or "").strip())
    return has_coords or has_text


def _resolve_one_signal_sync(signal: dict[str, Any], language_code: str = "en") -> dict[str, Any] | None:
    """Network call: resolve one signal to a canonical place via
    Places/Geocoding. Returns a 'mini-candidate' dict or None on failure."""
    try:
        lat = signal.get("parsed_latitude")
        lng = signal.get("parsed_longitude")
        if lat is not None and lng is not None:
            geo = reverse_geocode_coordinates(float(lat), float(lng), language_code=language_code)
        else:
            text = (signal.get("parsed_place_name") or "").strip()
            if len(text) < 3:
                return None
            geo = geocode_address(text, language_code=language_code)
    except Exception:
        return None

    if not geo:
        return None

    return {
        "source": signal["source"],
        "tier": signal.get("tier"),
        "signal_score": signal.get("signal_score"),
        "place_id": geo.get("place_id"),
        "place_name": signal.get("parsed_place_name") or geo.get("formatted_address"),
        "formatted_address": geo.get("formatted_address"),
        "country": geo.get("country"),
        "city": geo.get("city"),
        "latitude": geo.get("latitude"),
        "longitude": geo.get("longitude"),
        "address_components": geo.get("address_components") or [],
    }


def _group_key(mini: dict[str, Any]) -> str:
    """Bucket key: prefer place_id, else rounded coords, else name."""
    place_id = mini.get("place_id")
    if place_id:
        return f"pid:{place_id}"
    lat, lng = mini.get("latitude"), mini.get("longitude")
    if lat is not None and lng is not None:
        return f"geo:{round(float(lat), GEO_BUCKET_DECIMALS)},{round(float(lng), GEO_BUCKET_DECIMALS)}"
    return f"name:{(mini.get('place_name') or '').strip().lower()}"


def _build_candidate_from_group(members: list[dict[str, Any]]) -> dict[str, Any]:
    """Pick the most specific member as representative — proxy: more
    address_components = more specific, tiebreak on signal_score."""
    best = max(
        members,
        key=lambda m: (
            len(m.get("address_components") or []),
            m.get("signal_score") or 0.0,
        ),
    )
    return Candidate(
        place_name=best.get("place_name"),
        formatted_address=best.get("formatted_address"),
        country=best.get("country"),
        city=best.get("city"),
        latitude=best.get("latitude"),
        longitude=best.get("longitude"),
        google_place_id=best.get("place_id"),
        address_components=best.get("address_components") or [],
        contributing_sources=[m["source"] for m in members],
        member_signal_scores=[
            {
                "source": m["source"],
                "score": m.get("signal_score"),
                "tier": m.get("tier"),
            }
            for m in members
        ],
    ).to_dict()


def _component_names_lower(components: list[dict[str, Any]]) -> set[str]:
    names: set[str] = set()
    for component in components or []:
        long_name = (component.get("long_name") or "").strip().lower()
        short_name = (component.get("short_name") or "").strip().lower()
        if long_name:
            names.add(long_name)
        if short_name:
            names.add(short_name)
    return names


def _merge_into(narrower: dict[str, Any], broader: dict[str, Any]) -> dict[str, Any]:
    """Fold the broader candidate's contributing sources into the narrower
    one. Narrower's place fields are kept; broader is consumed."""
    sources = list(narrower.get("contributing_sources") or [])
    for src in broader.get("contributing_sources") or []:
        if src not in sources:
            sources.append(src)
    return {
        **narrower,
        "contributing_sources": sources,
        "member_signal_scores": (narrower.get("member_signal_scores") or [])
        + (broader.get("member_signal_scores") or []),
    }


def _hierarchical_merge(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """If candidate B's place_name appears as a component (locality / admin
    area / country) of candidate A's address_components, B is BROADER than
    A and gets folded into A. This collapses 'Paris' into 'Eiffel Tower'.

    Pure function (no I/O) — safe to test without network.
    """
    if len(candidates) < 2:
        return list(candidates)

    consumed: set[int] = set()
    survivors: list[dict[str, Any]] = []

    for i, narrower in enumerate(candidates):
        if i in consumed:
            continue
        narrower_components = _component_names_lower(
            narrower.get("address_components") or []
        )
        current = narrower
        for j, broader in enumerate(candidates):
            if j == i or j in consumed:
                continue
            broader_name = (broader.get("place_name") or "").strip().lower()
            if not broader_name:
                continue
            # Heuristic: broader's name appears in narrower's components
            # AND broader has fewer or equal components (it's a parent).
            if (
                broader_name in narrower_components
                and len(broader.get("address_components") or [])
                <= len(narrower.get("address_components") or [])
            ):
                current = _merge_into(current, broader)
                consumed.add(j)
        survivors.append(current)

    return survivors


async def normalize_signals_to_candidates(
    signals: list[dict[str, Any]],
    *,
    hints: SearchHintContext,
) -> list[dict[str, Any]]:
    """Convert raw signals into location candidates.

    1. Filter to location-bearing signals (skip empty / failed / scene-only).
    2. Parallel Places/Geocoding to map each signal to a canonical place.
    3. Group co-located signals (place_id ⇒ proximity ⇒ name).
    4. Hierarchical merge: collapse 'Paris' into 'Eiffel Tower' when the
       broader name appears as an address component of the narrower.

    Returns a list of candidate dicts (no ranks yet — scoring assigns those).
    """
    language_code = hints.google_language_code()

    eligible = [s for s in signals if _is_eligible(s)]
    if not eligible:
        return []

    tasks = [asyncio.to_thread(_resolve_one_signal_sync, s, language_code) for s in eligible]
    results = await asyncio.gather(*tasks)
    minis = [r for r in results if r is not None]
    if not minis:
        return []

    groups: dict[str, list[dict[str, Any]]] = {}
    for mini in minis:
        groups.setdefault(_group_key(mini), []).append(mini)

    candidates = [_build_candidate_from_group(group) for group in groups.values()]
    return _hierarchical_merge(candidates)
