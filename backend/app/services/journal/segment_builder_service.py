from __future__ import annotations

import math
import re
from collections.abc import Iterable
from datetime import timedelta

from app.services.journal.contracts import JournalObservation, JournalSegment
from app.services.journal.geo_utils import haversine_distance_meters

STAY_MERGE_DISTANCE_METERS = 150.0
STAY_MERGE_GAP_SECONDS = 7_200
TRANSIT_MERGE_GAP_SECONDS = 5_400
WALK_SPEED_KMH = 6.0
TAXI_SPEED_KMH = 40.0
WALK_DISTANCE_THRESHOLD_KM = 4.0


# Merge decisions still start from observation-to-observation distance.
def _distance_between(a: JournalObservation, b: JournalObservation) -> float:
    return haversine_distance_meters(
        a.center_latitude,
        a.center_longitude,
        b.center_latitude,
        b.center_longitude,
    )


# Nearby stay observations in the same city are grouped into one stay segment.
def _can_merge_stay(current: JournalObservation, candidate: JournalObservation) -> bool:
    if candidate.suggested_segment_type != "stay":
        return False

    distance = _distance_between(current, candidate)
    gap_seconds = (candidate.start_time - current.end_time).total_seconds()
    same_city = (
        current.city_snapshot is None
        or candidate.city_snapshot is None
        or current.city_snapshot == candidate.city_snapshot
    )

    return (
        distance <= STAY_MERGE_DISTANCE_METERS
        and gap_seconds <= STAY_MERGE_GAP_SECONDS
        and same_city
    )


# Transit observations are looser and mostly time-based.
def _can_merge_transit(current: JournalObservation, candidate: JournalObservation) -> bool:
    if candidate.suggested_segment_type != "transit":
        return False

    gap_seconds = (candidate.start_time - current.end_time).total_seconds()
    return gap_seconds <= TRANSIT_MERGE_GAP_SECONDS


# POI is the preferred user-facing location label, then city as a fallback.
def _segment_location_name(observations: list[JournalObservation]) -> str | None:
    for observation in observations:
        if observation.poi_name:
            return observation.poi_name

    for observation in observations:
        if observation.city_snapshot:
            return observation.city_snapshot

    return None


# The first token of the address is used as the English hint in the UI.
def _segment_english_location_hint(observations: list[JournalObservation]) -> str | None:
    for observation in observations:
        if observation.english_location_hint:
            return observation.english_location_hint
    return None


# Keep one formatted address per segment for display and similarity checks.
def _segment_formatted_address(observations: list[JournalObservation]) -> str | None:
    for observation in observations:
        if observation.formatted_address:
            return observation.formatted_address
    return None


# This is the raw observed duration from the images inside one segment.
def _observed_duration_minutes(segment: JournalSegment) -> int:
    return math.ceil(max((segment.end_time - segment.start_time).total_seconds(), 0.0) / 60.0)


# Large venues can shift around internally, so the first address token is used
# as a rough same-place signal.
def _address_head(formatted_address: str | None) -> str | None:
    if not formatted_address:
        return None

    head = formatted_address.split(",")[0].strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", head).strip()
    return normalized or None


# Same address head usually means one venue, even when coordinates are noisy.
def _similar_segment_address(current: JournalSegment, candidate: JournalSegment) -> bool:
    current_head = _address_head(current.formatted_address)
    candidate_head = _address_head(candidate.formatted_address)
    if not current_head or not candidate_head:
        return False
    return current_head == candidate_head


# Different-place inference uses the last observation of the current segment
# and the first observation of the next segment.
def _segment_edge_observations(
    grouped_observations: list[list[JournalObservation]],
    index: int,
) -> tuple[JournalObservation, JournalObservation] | None:
    if index + 1 >= len(grouped_observations):
        return None

    current_group = grouped_observations[index]
    next_group = grouped_observations[index + 1]
    return current_group[-1], next_group[0]


# If address head matches or the coordinates are close, treat the two segments
# as the same place and do not insert transit.
def _same_place_between_segments(
    current: JournalSegment,
    candidate: JournalSegment,
    current_observation: JournalObservation,
    candidate_observation: JournalObservation,
) -> bool:
    if _similar_segment_address(current, candidate):
        return True

    return _distance_between(current_observation, candidate_observation) <= STAY_MERGE_DISTANCE_METERS


# Travel mode is inferred only when there was no actual transit segment.
def _infer_travel_details(
    current_observation: JournalObservation,
    next_observation: JournalObservation,
) -> tuple[str, float, int]:
    distance_km = _distance_between(current_observation, next_observation) / 1000.0
    if distance_km <= WALK_DISTANCE_THRESHOLD_KM:
        speed_kmh = WALK_SPEED_KMH
        mode = "walk"
    else:
        speed_kmh = TAXI_SPEED_KMH
        mode = "taxi"

    minutes = max(1, math.ceil((distance_km / speed_kmh) * 60.0))
    return mode, round(distance_km, 2), minutes


# Base segments are built first without inferred transit.
def _build_segment(
    observations: list[JournalObservation],
    *,
    segment_order: int,
) -> JournalSegment:
    segment_type = observations[0].suggested_segment_type or "uncertain"
    start_time = observations[0].start_time
    end_time = observations[-1].end_time
    image_ids: list[int] = []

    for observation in observations:
        image_ids.extend(observation.image_ids)

    location_name = _segment_location_name(observations)
    country = next((item.country_snapshot for item in observations if item.country_snapshot), None)
    city = next((item.city_snapshot for item in observations if item.city_snapshot), None)

    return JournalSegment(
        segment_id=f"seg-{segment_order}",
        segment_order=segment_order,
        segment_type=segment_type,
        is_inferred=False,
        observation_ids=[observation.observation_id for observation in observations],
        image_ids=image_ids,
        location_name=location_name,
        country=country,
        city=city,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=math.ceil(max((end_time - start_time).total_seconds(), 0.0) / 60.0),
        formatted_address=_segment_formatted_address(observations),
        english_location_hint=_segment_english_location_hint(observations),
        travel_mode=None,
        travel_distance_km=None,
    )


# This is the inferred transit card inserted between two stay segments
# when the user has no actual transit photos.
def _build_inferred_transit_segment(
    *,
    start_time,
    end_time,
    country: str | None,
    city: str | None,
    travel_mode: str,
    travel_distance_km: float,
) -> JournalSegment:
    duration_minutes = max(math.ceil((end_time - start_time).total_seconds() / 60.0), 0)
    return JournalSegment(
        segment_id="",
        segment_order=0,
        segment_type="transit",
        is_inferred=True,
        observation_ids=[],
        image_ids=[],
        location_name="Default transit",
        country=country,
        city=city,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=duration_minutes,
        formatted_address=None,
        english_location_hint=None,
        travel_mode=travel_mode,
        travel_distance_km=travel_distance_km,
    )


# Final timeline is built by walking segments from left to right.
# Stay duration is assigned from the current segment start until the departure
# for the next segment, so the gap belongs to the current stay, not the next one.
def _finalize_timeline(
    base_segments: list[JournalSegment],
    grouped_observations: list[list[JournalObservation]],
) -> list[JournalSegment]:
    final_segments: list[JournalSegment] = []

    for index, current_segment in enumerate(base_segments):
        segment_date = current_segment.start_time.date()
        observed_duration_minutes = _observed_duration_minutes(current_segment)
        next_segment = base_segments[index + 1] if index + 1 < len(base_segments) else None
        edge_observations = _segment_edge_observations(grouped_observations, index)

        if current_segment.segment_type != "stay":
            if current_segment.duration_minutes == 0:
                current_segment.duration_minutes = None
            final_segments.append(current_segment)
            continue

        if next_segment is None or next_segment.start_time.date() != segment_date:
            current_segment.duration_minutes = observed_duration_minutes if observed_duration_minutes > 0 else None
            final_segments.append(current_segment)
            continue

        if next_segment.segment_type == "transit":
            departure_time = next_segment.start_time
            current_segment.duration_minutes = max(
                observed_duration_minutes,
                math.ceil((departure_time - current_segment.start_time).total_seconds() / 60.0),
            )
            final_segments.append(current_segment)
            continue

        if next_segment.segment_type != "stay" or edge_observations is None:
            current_segment.duration_minutes = observed_duration_minutes if observed_duration_minutes > 0 else None
            final_segments.append(current_segment)
            continue

        current_observation, next_observation = edge_observations

        if _same_place_between_segments(current_segment, next_segment, current_observation, next_observation):
            departure_time = next_segment.start_time
            current_segment.duration_minutes = max(
                observed_duration_minutes,
                math.ceil((departure_time - current_segment.start_time).total_seconds() / 60.0),
            )
            final_segments.append(current_segment)
            continue

        travel_mode, travel_distance_km, inferred_travel_minutes = _infer_travel_details(
            current_observation,
            next_observation,
        )
        tentative_transit_start = next_segment.start_time - timedelta(minutes=inferred_travel_minutes)
        transit_start = max(tentative_transit_start, current_segment.end_time)
        current_segment.duration_minutes = max(
            observed_duration_minutes,
            math.ceil((transit_start - current_segment.start_time).total_seconds() / 60.0),
        )
        final_segments.append(current_segment)
        final_segments.append(
            _build_inferred_transit_segment(
                start_time=transit_start,
                end_time=next_segment.start_time,
                country=current_segment.country,
                city=current_segment.city or next_segment.city,
                travel_mode=travel_mode,
                travel_distance_km=travel_distance_km,
            )
        )

    for index, segment in enumerate(final_segments, start=1):
        segment.segment_order = index
        segment.segment_id = f"seg-{index}"

    return final_segments


# Classified observations are merged first, then inferred transit cards
# and final stay durations are computed.
def build_segments(observations: Iterable[JournalObservation]) -> list[JournalSegment]:
    ordered_observations = sorted(observations, key=lambda item: item.observation_order)
    if not ordered_observations:
        return []

    grouped_observations: list[list[JournalObservation]] = [[ordered_observations[0]]]

    for observation in ordered_observations[1:]:
        current_group = grouped_observations[-1]
        previous_observation = current_group[-1]
        previous_type = previous_observation.suggested_segment_type or "uncertain"
        current_type = observation.suggested_segment_type or "uncertain"

        should_merge = False
        if previous_type == current_type == "stay":
            should_merge = _can_merge_stay(previous_observation, observation)
        elif previous_type == current_type == "transit":
            should_merge = _can_merge_transit(previous_observation, observation)

        if should_merge:
            current_group.append(observation)
        else:
            grouped_observations.append([observation])

    base_segments = [
        _build_segment(group, segment_order=index)
        for index, group in enumerate(grouped_observations, start=1)
    ]
    return _finalize_timeline(base_segments, grouped_observations)
