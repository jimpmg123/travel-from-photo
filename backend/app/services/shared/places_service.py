from __future__ import annotations

import json
from typing import Any
from urllib.request import Request, urlopen

from app.core.config import GOOGLE_MAPS_API_KEY
from app.services.shared.geocoding_service import reverse_geocode_coordinates

GOOGLE_PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
DEFAULT_POI_RADIUS_METERS = 150.0
DEFAULT_POI_MAX_RESULTS = 5
PLACES_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.types",
    ]
)


# Places / Geocoding 호출 전에 Google Maps API 키가 있는지 확인한다.
def _require_api_key() -> str:
    if not GOOGLE_MAPS_API_KEY:
        raise RuntimeError(
            "GOOGLE_MAPS_API_KEY is not set. Enable Geocoding API and Places API (New), then add the key to backend/.env."
        )

    return GOOGLE_MAPS_API_KEY


# HTTP POST 결과를 JSON으로 읽는 공통 헬퍼다.
def _load_json_post(url: str, *, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


# Places API (New) Nearby Search로 observation 근처 POI를 조회한다.
def search_nearby_pois(
    latitude: float,
    longitude: float,
    *,
    radius_meters: float = DEFAULT_POI_RADIUS_METERS,
    max_result_count: int = DEFAULT_POI_MAX_RESULTS,
    language_code: str = "en",
    included_types: list[str] | None = None,
    included_primary_types: list[str] | None = None,
) -> dict[str, Any]:
    api_key = _require_api_key()

    payload: dict[str, Any] = {
        "maxResultCount": max_result_count,
        "rankPreference": "DISTANCE",
        "languageCode": language_code,
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                "radius": radius_meters,
            }
        },
    }

    if included_types:
        payload["includedTypes"] = included_types
    if included_primary_types:
        payload["includedPrimaryTypes"] = included_primary_types

    response_payload = _load_json_post(
        GOOGLE_PLACES_NEARBY_URL,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": PLACES_FIELD_MASK,
        },
        payload=payload,
    )

    places = response_payload.get("places", [])
    normalized_places: list[dict[str, Any]] = []
    for place in places:
        display_name = place.get("displayName", {})
        location = place.get("location", {})
        normalized_places.append(
            {
                "id": place.get("id"),
                "name": display_name.get("text"),
                "formatted_address": place.get("formattedAddress"),
                "primary_type": place.get("primaryType"),
                "types": place.get("types", []),
                "latitude": location.get("latitude"),
                "longitude": location.get("longitude"),
            }
        )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "radius_meters": radius_meters,
        "places": normalized_places,
        "top_place": normalized_places[0] if normalized_places else None,
    }


# 좌표 하나에 대해 주소 정보와 nearby POI를 한 번에 묶어 반환한다.
def enrich_coordinates_with_place_context(
    latitude: float,
    longitude: float,
    *,
    poi_radius_meters: float = DEFAULT_POI_RADIUS_METERS,
    poi_max_result_count: int = DEFAULT_POI_MAX_RESULTS,
    language_code: str = "en",
) -> dict[str, Any]:
    address = reverse_geocode_coordinates(latitude, longitude, language_code=language_code)
    nearby = search_nearby_pois(
        latitude,
        longitude,
        radius_meters=poi_radius_meters,
        max_result_count=poi_max_result_count,
        language_code=language_code,
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "country": address["country"],
        "city": address["city"],
        "region": address["region"],
        "formatted_address": address["formatted_address"],
        "address_place_id": address["place_id"],
        "top_poi": nearby["top_place"],
        "pois": nearby["places"],
    }
