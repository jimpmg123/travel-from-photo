from __future__ import annotations

import math
import re
from typing import Any

from app.services.search.candidate_scorer_service import compute_verdict
from app.services.search.contracts import SearchHintContext

# Distance buckets (km) for the same-trip GPS proximity boost.
NEAR_KM = 5.0
NEAR_MULTIPLIER = 1.20
MID_KM = 20.0
MID_MULTIPLIER = 1.10

# Hint match adjustments.
COUNTRY_MATCH = 1.20
COUNTRY_MISMATCH = 0.30
CITY_MATCH = 1.15
TEXT_KEYWORD_MATCH = 1.10


def _normalize_token(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _user_hint_keywords(user_hint: str | None) -> set[str]:
    if not user_hint:
        return set()
    return {word for word in re.findall(r"[a-zA-Z]{3,}", user_hint.lower())}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _proximity_multiplier(
    candidate: dict[str, Any], cluster: list[tuple[float, float]] | None
) -> float:
    if not cluster:
        return 1.0
    lat = candidate.get("latitude")
    lng = candidate.get("longitude")
    if lat is None or lng is None:
        return 1.0
    nearest = min(_haversine_km(float(lat), float(lng), c_lat, c_lng) for c_lat, c_lng in cluster)
    if nearest <= NEAR_KM:
        return NEAR_MULTIPLIER
    if nearest <= MID_KM:
        return MID_MULTIPLIER
    return 1.0


def _hint_multiplier(candidate: dict[str, Any], hints: SearchHintContext) -> tuple[float, list[str]]:
    multiplier = 1.0
    notes: list[str] = []

    country_hint = _normalize_token(hints.normalized_country())
    if country_hint:
        candidate_country = _normalize_token(candidate.get("country"))
        if candidate_country and candidate_country == country_hint:
            multiplier *= COUNTRY_MATCH
            notes.append(f"country hint match (x{COUNTRY_MATCH})")
        elif candidate_country:
            multiplier *= COUNTRY_MISMATCH
            notes.append(f"country hint mismatch (x{COUNTRY_MISMATCH})")

    city_hint = _normalize_token(hints.normalized_city())
    if city_hint:
        candidate_city = _normalize_token(candidate.get("city"))
        if candidate_city and candidate_city == city_hint:
            multiplier *= CITY_MATCH
            notes.append(f"city hint match (x{CITY_MATCH})")

    keywords = _user_hint_keywords(hints.normalized_user_hint())
    if keywords:
        text = " ".join(
            str(candidate.get(field) or "")
            for field in ("place_name", "formatted_address", "city", "country")
        ).lower()
        if any(word in text for word in keywords):
            multiplier *= TEXT_KEYWORD_MATCH
            notes.append(f"user text keyword match (x{TEXT_KEYWORD_MATCH})")

    return multiplier, notes


def reweight_candidates(
    candidates: list[dict[str, Any]],
    *,
    hints: SearchHintContext,
    same_session_gps_cluster: list[tuple[float, float]] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    """Apply Layer-6 reweighting: hint match adjustments and same-trip GPS
    proximity boost. Returns the re-sorted candidates + the recomputed verdict."""

    reweighted: list[dict[str, Any]] = []
    for candidate in candidates:
        base = candidate.get("aggregated_score") or 0.0
        hint_mult, notes = _hint_multiplier(candidate, hints)
        prox_mult = _proximity_multiplier(candidate, same_session_gps_cluster)
        if prox_mult != 1.0:
            notes.append(f"same-trip GPS proximity (x{prox_mult})")

        adjusted = min(base * hint_mult * prox_mult, 1.0)
        updated = {
            **candidate,
            "aggregated_score": round(adjusted, 4),
            "reasoning": "; ".join(notes) if notes else candidate.get("reasoning"),
        }
        reweighted.append(updated)

    reweighted.sort(key=lambda candidate: candidate.get("aggregated_score") or 0.0, reverse=True)
    for index, candidate in enumerate(reweighted, start=1):
        candidate["rank"] = index

    return reweighted, compute_verdict(reweighted)
