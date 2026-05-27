from __future__ import annotations

from typing import Any

# Per-source prior: how trustworthy each helper is on average. Tuned with
# real data later; first-cut numbers from the design doc.
SOURCE_PRIOR: dict[str, float] = {
    "exif_gps": 1.00,
    "vision_landmark": 0.75,
    "gpt4o_main": 0.75,     # Method A — independent voter
    "vision_logo": 0.70,
    "vision_web": 0.70,
    "vision_ocr": 0.50,
    # vision_label / vision_object are scene-only and don't make candidates.
    # gpt4o_arbiter is INTENTIONALLY absent: the arbiter only re-ranks
    # existing candidates, it does not add a new vote (no double counting).
}
DEFAULT_PRIOR = 0.30

# Group sources by inference mechanism. The independence bonus counts the
# number of DISTINCT groups that agree on a candidate. Two LLMs landing in
# the same 'llm' group count as one, addressing the LLM-LLM correlated-
# error critique even though we only use GPT today.
MECHANISM_GROUP: dict[str, str] = {
    "exif_gps": "hardware",
    "vision_ocr": "text",
    "vision_landmark": "db_match",
    "vision_logo": "db_match",
    "vision_web": "reverse_search",
    "gpt4o_main": "llm",
    "vision_label": "general_ml",
    "vision_object": "general_ml",
}

# Multiplicative bonus per extra independent group.
#   1 group  -> ×1.00   (no bonus, single source)
#   2 groups -> ×1.15
#   3 groups -> ×1.30
#   4 groups -> ×1.45
INDEPENDENCE_BONUS_PER_GROUP = 0.15
INDEPENDENCE_MAX_GROUPS = 5


def _per_source_contribution(member: dict[str, Any]) -> float:
    source = member.get("source") or ""
    status = member.get("status") or "resolved"
    
    if status in ("failed", "empty"):
        return 0.0
        
    prior = SOURCE_PRIOR.get(source, DEFAULT_PRIOR)
    raw_score = member.get("score")
    if raw_score is None:
        raw_score = 0.6
    return prior * float(raw_score)


def _independence_multiplier(member_scores: list[dict[str, Any]]) -> float:
    groups: set[str] = set()
    for member in member_scores:
        if member.get("status") in ("failed", "empty"):
            continue
        source = member.get("source") or ""
        group = MECHANISM_GROUP.get(source)
        if group:
            groups.add(group)
    bonus_groups = max(0, min(len(groups), INDEPENDENCE_MAX_GROUPS) - 1)
    return 1.0 + INDEPENDENCE_BONUS_PER_GROUP * bonus_groups


def _score_one_candidate(candidate: dict[str, Any]) -> float:
    members = candidate.get("member_signal_scores") or []
    if not members:
        return 0.0
    base = sum(_per_source_contribution(m) for m in members)
    multiplier = _independence_multiplier(members)
    return min(base * multiplier, 1.0)


def score_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scored = [
        {**c, "aggregated_score": round(_score_one_candidate(c), 4)}
        for c in candidates
    ]
    scored.sort(key=lambda c: c.get("aggregated_score") or 0.0, reverse=True)
    for index, candidate in enumerate(scored, start=1):
        candidate["rank"] = index
    return scored


def compute_verdict(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return "failed"

    top = candidates[0].get("aggregated_score") or 0.0
    if top < 0.20:
        return "failed"

    if len(candidates) == 1:
        if top >= 0.75:
            return "confident"
        elif top >= 0.40:
            return "likely"
        return "suggestions"

    second = candidates[1].get("aggregated_score") or 0.0
    gap = top - second

    if top >= 0.75 and gap >= 0.20:
        return "confident"
    if top >= 0.50 and gap >= 0.10:
        return "likely"
    if top >= 0.35 and gap >= 0.25:
        return "likely"

    return "suggestions"


def score_and_rank(
    candidates: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str]:
    scored = score_candidates(candidates)
    return scored, compute_verdict(scored)
