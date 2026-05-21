from __future__ import annotations

from typing import Any

# Per-source priors: how much we trust each API as evidence for a place.
# These are first-cut numbers from 핵심 기능 계획 (GPS=100, franchise via logo
# ~80, etc.) — they get tuned with real data later. Sources missing from
# this map fall back to DEFAULT_PRIOR.
SOURCE_PRIOR: dict[str, float] = {
    "exif_gps": 1.00,
    "vision_landmark": 0.85,
    "gpt4o_vision": 0.75,
    "vision_logo": 0.70,
    "vision_web": 0.65,
    "vision_ocr": 0.50,
}
DEFAULT_PRIOR = 0.30

def _per_source_contribution(member: dict[str, Any]) -> float:
    source = member.get("source") or ""
    prior = SOURCE_PRIOR.get(source, DEFAULT_PRIOR)
    # Some sources don't report a numeric score (e.g. OCR text). Treat them
    # as moderate confidence so they aren't silently dropped.
    raw_score = member.get("score")
    if raw_score is None:
        raw_score = 0.6
    return prior * float(raw_score)


def _score_one_candidate(candidate: dict[str, Any]) -> float:
    """Sum prior × score across contributing sources, clip to [0, 1]. This
    means a single strong source (EXIF GPS = 1.0×1.0) can already be
    'confident', while three independent agreeing sources saturate at 1.0."""

    members = candidate.get("member_signal_scores") or []
    if not members:
        return 0.0
    return min(sum(_per_source_contribution(member) for member in members), 1.0)


def score_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add aggregated_score to each candidate, then sort high-to-low and
    assign rank. Returns a new list — does not mutate input order."""

    scored = []
    for candidate in candidates:
        score = round(_score_one_candidate(candidate), 4)
        scored.append({**candidate, "aggregated_score": score})

    scored.sort(key=lambda candidate: candidate.get("aggregated_score") or 0.0, reverse=True)
    for index, candidate in enumerate(scored, start=1):
        candidate["rank"] = index

    return scored


def compute_verdict(candidates: list[dict[str, Any]]) -> str:
    """Map the scored candidate list to one of: confident / likely /
    suggestions / failed. This is the 4-case classification from the plan."""

    if not candidates:
        return "failed"

    top = candidates[0].get("aggregated_score") or 0.0
    second = candidates[1].get("aggregated_score") or 0.0 if len(candidates) > 1 else 0.0
    gap = top - second
    multi_close = len(candidates) >= 2 and gap < 0.10

    # Case 4: only one weak guess, nothing to fall back to → failed.
    if not multi_close and top < 0.20:
        return "failed"

    # Case 1: strong leader, well clear of any runner-up.
    if top >= 0.75 and gap >= 0.20:
        return "confident"

    # Case 2: clear-but-not-overwhelming leader.
    if top >= 0.50 and gap >= 0.10:
        return "likely"

    # Case 3: multiple candidates clustered close → ask the user.
    return "suggestions"


def score_and_rank(candidates: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    scored = score_candidates(candidates)
    verdict = compute_verdict(scored)
    return scored, verdict
