from __future__ import annotations

import re
from collections.abc import Iterable

from app.services.journal.contracts import JournalObservation
from app.services.journal.geo_utils import haversine_distance_meters

# Journal segment classification starts from one observation and decides
# whether it looks like stay, transit, or uncertain.
# Time flow, coordinate distance, address head similarity, POI type,
# scene label, and document type are all converted into scores.

SAME_PLACE_RADIUS_METERS = 120.0
MIN_STAY_REVISIT_GAP_SECONDS = 120.0
TRANSIT_PATH_FACTOR = 1.25
CLASSIFICATION_MARGIN = 0.20
ADDRESS_SIMILAR_STAY_SCORE = 0.40

# Google Places type values are not stable enough to justify exact matching.
# Since the current design gives the same score either way,
# keyword rules are simpler and easier to maintain.
DESTINATION_POI_TYPE_KEYWORDS = (
    "art_gallery",
    "beach",
    "cafe",
    "campground",
    "church",
    "food",
    "gallery",
    "historic",
    "history",
    "hotel",
    "lodging",
    "market",
    "monument",
    "mosque",
    "museum",
    "park",
    "place_of_worship",
    "restaurant",
    "shrine",
    "store",
    "synagogue",
    "temple",
    "tourist",
    "visitor",
    "zoo",
)

TRANSIT_POI_TYPE_KEYWORDS = (
    "airport",
    "bus_station",
    "ferry",
    "platform",
    "rail",
    "station",
    "subway",
    "terminal",
    "train",
    "transit",
)

STAY_DOCUMENT_TYPES = {
    "lodging_confirmation",
    "museum_ticket",
    "receipt",
}

TRANSIT_DOCUMENT_TYPES = {
    "transport_ticket",
}


# This is the basic geospatial comparison used across the classifier.
def _distance_between(a: JournalObservation, b: JournalObservation) -> float:
    return haversine_distance_meters(
        a.center_latitude,
        a.center_longitude,
        b.center_latitude,
        b.center_longitude,
    )


# Nearby observations within this radius are treated as same-place candidates.
def _same_place_signal(a: JournalObservation, b: JournalObservation) -> tuple[bool, float]:
    distance = _distance_between(a, b)
    return distance <= SAME_PLACE_RADIUS_METERS, distance


# Places and labels come in with slightly different formatting,
# so normalize them once before matching.
def _normalize_type(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip().lower().replace(" ", "_")


# POI type is only used as a hint.
# We intentionally keep it broad and keyword-based.
def _classify_poi_type_signal(poi_type: str | None) -> str | None:
    normalized = _normalize_type(poi_type)
    if normalized is None:
        return None

    if any(keyword in normalized for keyword in DESTINATION_POI_TYPE_KEYWORDS):
        return "destination"
    if any(keyword in normalized for keyword in TRANSIT_POI_TYPE_KEYWORDS):
        return "transit"
    return None


# For large venues, exact coordinates can drift across gates or internal roads.
# The first address token is used as a coarse same-venue hint.
def _address_head(formatted_address: str | None) -> str | None:
    if not formatted_address:
        return None

    head = formatted_address.split(",")[0].strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", head).strip()
    return normalized or None


# If two observations share the same address head, they may belong
# to the same large place even when the raw coordinates spread out.
def _similar_address_head(a: JournalObservation, b: JournalObservation) -> bool:
    a_head = _address_head(a.formatted_address)
    b_head = _address_head(b.formatted_address)
    if not a_head or not b_head:
        return False
    return a_head == b_head


# POI, scene, and document signals are converted into stay/transit score deltas.
def _score_labels(
    observation: JournalObservation,
    *,
    stay_score: float,
    transit_score: float,
    reasons: list[str],
) -> tuple[float, float]:
    scene_label = _normalize_type(observation.scene_label)
    document_type = _normalize_type(observation.document_type)
    poi_signal = _classify_poi_type_signal(observation.poi_primary_type)

    if poi_signal == "destination":
        stay_score += 0.45
        reasons.append("Nearby POI looks destination-like.")
    elif poi_signal == "transit":
        transit_score += 0.55
        reasons.append("Nearby POI looks transit-related.")

    if scene_label == "destination_scene":
        stay_score += 0.35
        reasons.append("Image context looks like a destination scene.")
    elif scene_label == "transport_related_scene":
        transit_score += 0.45
        reasons.append("Image context looks transport-related.")
    elif scene_label == "food_photo":
        stay_score += 0.40
        reasons.append("Food photos usually belong to a stay segment.")
    elif scene_label == "document_like":
        transit_score += 0.05
        reasons.append("Document-like observation needs extra caution.")

    if document_type in STAY_DOCUMENT_TYPES:
        stay_score += 0.45
        reasons.append("Document type supports a stay segment.")
    elif document_type in TRANSIT_DOCUMENT_TYPES:
        transit_score += 0.55
        reasons.append("Document type supports a transit segment.")

    return stay_score, transit_score


# This is the main scoring function used before segment building.
def classify_observation(
    observation: JournalObservation,
    *,
    previous_observation: JournalObservation | None = None,
    next_observation: JournalObservation | None = None,
) -> JournalObservation:
    stay_score = 0.0
    transit_score = 0.0
    reasons: list[str] = []

    if observation.image_count > 1:
        stay_score += 0.10
        reasons.append("Burst observation adds a small stay bias.")

    if observation.duration_seconds() >= 600:
        stay_score += 0.35
        reasons.append("Long observation duration suggests a stay.")

    previous_same_place = False
    next_same_place = False
    previous_similar_address = False
    next_similar_address = False

    if previous_observation is not None:
        previous_same_place, _ = _same_place_signal(previous_observation, observation)
        previous_similar_address = _similar_address_head(previous_observation, observation)
        time_gap = (observation.start_time - previous_observation.end_time).total_seconds()

        if previous_same_place and time_gap >= MIN_STAY_REVISIT_GAP_SECONDS:
            stay_score += 0.35
            reasons.append("Previous nearby observation after a time gap suggests a stay.")

        if previous_similar_address and time_gap >= MIN_STAY_REVISIT_GAP_SECONDS:
            stay_score += ADDRESS_SIMILAR_STAY_SCORE
            reasons.append("Previous observation shares the same address head, suggesting the same venue.")
        elif not previous_same_place and time_gap <= 900:
            transit_score += 0.10
            reasons.append("Recent movement from a different place adds transit bias.")

    if next_observation is not None:
        next_same_place, _ = _same_place_signal(observation, next_observation)
        next_similar_address = _similar_address_head(observation, next_observation)
        time_gap = (next_observation.start_time - observation.end_time).total_seconds()

        if next_same_place and time_gap >= MIN_STAY_REVISIT_GAP_SECONDS:
            stay_score += 0.35
            reasons.append("Next nearby observation after a time gap suggests a stay.")

        if next_similar_address and time_gap >= MIN_STAY_REVISIT_GAP_SECONDS:
            stay_score += ADDRESS_SIMILAR_STAY_SCORE
            reasons.append("Next observation shares the same address head, suggesting the same venue.")
        elif not next_same_place and time_gap <= 900:
            transit_score += 0.10
            reasons.append("Upcoming movement to a different place adds transit bias.")

    if previous_same_place and next_same_place:
        stay_score += 0.20
        reasons.append("Nearby observations on both sides strongly suggest a stay.")
    elif previous_similar_address and next_similar_address:
        stay_score += 0.20
        reasons.append("Address heads match on both sides, suggesting one large place.")

    if previous_observation is not None and next_observation is not None:
        prev_to_current = _distance_between(previous_observation, observation)
        current_to_next = _distance_between(observation, next_observation)
        prev_to_next = _distance_between(previous_observation, next_observation)
        if (
            not previous_same_place
            and not next_same_place
            and prev_to_next > SAME_PLACE_RADIUS_METERS
            and prev_to_current + current_to_next <= prev_to_next * TRANSIT_PATH_FACTOR
        ):
            transit_score += 0.35
            reasons.append("Observation lies on the path between two different places.")

    stay_score, transit_score = _score_labels(
        observation,
        stay_score=stay_score,
        transit_score=transit_score,
        reasons=reasons,
    )

    if stay_score - transit_score >= CLASSIFICATION_MARGIN:
        segment_type = "stay"
    elif transit_score - stay_score >= CLASSIFICATION_MARGIN:
        segment_type = "transit"
    else:
        segment_type = "uncertain"
        reasons.append("Stay and transit signals are too close.")

    observation.stay_score = round(stay_score, 3)
    observation.transit_score = round(transit_score, 3)
    observation.suggested_segment_type = segment_type
    observation.classification_reason = " ".join(reasons) if reasons else "No strong signal was found."
    return observation


# Classification always uses ordered observations so the previous/next context is available.
def classify_observations(observations: Iterable[JournalObservation]) -> list[JournalObservation]:
    ordered_observations = sorted(observations, key=lambda item: item.observation_order)
    classified: list[JournalObservation] = []

    for index, observation in enumerate(ordered_observations):
        previous_observation = ordered_observations[index - 1] if index > 0 else None
        next_observation = ordered_observations[index + 1] if index + 1 < len(ordered_observations) else None
        classified.append(
            classify_observation(
                observation,
                previous_observation=previous_observation,
                next_observation=next_observation,
            )
        )

    return classified
