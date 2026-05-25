"""User-level travel statistics aggregated from journal_entries.

Aggregations are computed on the fly per spec — at this scale (a single user's
journals) the row count is tiny and caching adds bug surface without buying
measurable speed. Distance is haversine between consecutive entries sorted by
captured_at, summed across all of the user's journals.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.journal import Journal, JournalEntry

EARTH_RADIUS_METERS = 6_371_000.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    )
    return (EARTH_RADIUS_METERS * 2 * math.asin(math.sqrt(a))) / 1000.0


def compute_user_stats(db: Session, user_id: int) -> dict[str, Any]:
    """Return a stats blob safe to JSON-serialize and send to the frontend
    (and pass straight to the recommendation GPT)."""
    stmt = (
        select(JournalEntry)
        .join(Journal, Journal.id == JournalEntry.journal_id)
        .where(Journal.user_id == user_id)
    )
    entries: list[JournalEntry] = list(db.execute(stmt).scalars().all())

    countries = {e.country for e in entries if e.country}
    cities = {e.city for e in entries if e.city}

    # v3: subject is also multi-label now (list), and activity is a new axis.
    subject_counter: Counter[str] = Counter()
    atmosphere_counter: Counter[str] = Counter()
    activity_counter: Counter[str] = Counter()
    cultural_layer_counter: Counter[str] = Counter()
    color_mood_counter: Counter[str] = Counter()
    composition_counter: Counter[str] = Counter()
    time_of_day_counter: Counter[str] = Counter()

    for e in entries:
        for tag in e.clip_subject or []:
            subject_counter[tag] += 1
        for theme in e.clip_atmosphere or []:
            atmosphere_counter[theme] += 1
        for action in e.clip_activity or []:
            activity_counter[action] += 1
        if e.gpt_cultural_layer:
            cultural_layer_counter[e.gpt_cultural_layer] += 1
        if e.gpt_color_mood:
            color_mood_counter[e.gpt_color_mood] += 1
        if e.gpt_composition_habit:
            composition_counter[e.gpt_composition_habit] += 1
        if e.gpt_time_of_day:
            time_of_day_counter[e.gpt_time_of_day] += 1

    # Per-journal haversine sum, then sum across journals.
    by_journal: dict[int, list[JournalEntry]] = defaultdict(list)
    for e in entries:
        by_journal[e.journal_id].append(e)

    total_distance_km = 0.0
    for journal_entries in by_journal.values():
        sorted_entries = sorted(
            (e for e in journal_entries if e.latitude is not None and e.longitude is not None and e.captured_at is not None),
            key=lambda e: e.captured_at,
        )
        for prev, curr in zip(sorted_entries, sorted_entries[1:]):
            total_distance_km += _haversine_km(
                float(prev.latitude), float(prev.longitude),
                float(curr.latitude), float(curr.longitude),
            )

    return {
        "photo_count": len(entries),
        "country_count": len(countries),
        "city_count": len(cities),
        "countries": sorted(countries),
        "cities": sorted(cities),
        "total_distance_km": round(total_distance_km, 1),
        "subject_distribution": dict(subject_counter),
        "atmosphere_distribution": dict(atmosphere_counter),
        "activity_distribution": dict(activity_counter),
        "cultural_layer_distribution": dict(cultural_layer_counter),
        "color_mood_distribution": dict(color_mood_counter),
        "composition_distribution": dict(composition_counter),
        "time_of_day_distribution": dict(time_of_day_counter),
    }
