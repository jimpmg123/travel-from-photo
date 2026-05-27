from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

from app.core.config import GOOGLE_MAPS_API_KEY

logger = logging.getLogger(__name__)
GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def _require_api_key() -> str:
    if not GOOGLE_MAPS_API_KEY:
        logger.critical("GOOGLE_MAPS_API_KEY is missing in environment variables.")
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not set.")
    return GOOGLE_MAPS_API_KEY


def _parse_address_components(result: dict[str, Any]) -> dict[str, str | None]:
    components = result.get("address_components", [])
    country = None
    city = None
    region = None

    for component in components:
        types = set(component.get("types", []))
        long_name = component.get("long_name")

        if "country" in types and country is None:
            country = long_name
        if "locality" in types and city is None:
            city = long_name
        if "administrative_area_level_1" in types and region is None:
            region = long_name

    if city is None:
        for component in components:
            types = set(component.get("types", []))
            if "administrative_area_level_2" in types:
                city = component.get("long_name")
                break

    return {
        "country": country,
        "city": city,
        "region": region,
    }


def _load_geocode_json(query_params: dict[str, Any]) -> dict[str, Any]:
    api_key = _require_api_key()
    query = urlencode({**query_params, "key": api_key})
    try:
        with urlopen(f"{GOOGLE_GEOCODE_URL}?{query}", timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Geocoding HTTP request failed: {str(e)}")
        raise


def _normalize_geocode_result(result: dict[str, Any]) -> dict[str, Any]:
    geometry = result.get("geometry", {})
    location = geometry.get("location", {})
    parsed_components = _parse_address_components(result)

    return {
        "formatted_address": result.get("formatted_address"),
        "place_id": result.get("place_id"),
        "result_types": result.get("types", []),
        "country": parsed_components["country"],
        "city": parsed_components["city"],
        "region": parsed_components["region"],
        "latitude": location.get("lat"),
        "longitude": location.get("lng"),
        "address_components": result.get("address_components", []),
    }


def reverse_geocode_coordinates(
    latitude: float,
    longitude: float,
    *,
    language_code: str = "en",
) -> dict[str, Any] | None:
    payload = _load_geocode_json(
        {
            "latlng": f"{latitude},{longitude}",
            "language": language_code,
        }
    )

    status = payload.get("status")
    if status == "ZERO_RESULTS":
        logger.warning(f"No geocoding results found for coordinates: {latitude}, {longitude}")
        return None
    if status != "OK":
        logger.error(f"Google reverse geocoding failed with status: {status}")
        raise RuntimeError(f"Google reverse geocoding failed with status: {status}")

    results = payload.get("results", [])
    if not results:
        return None

    top_result = _normalize_geocode_result(results[0])
    return {
        "query_latitude": latitude,
        "query_longitude": longitude,
        **top_result,
        "raw_results_count": len(results),
    }


def geocode_address(
    address: str,
    *,
    language_code: str = "en",
    region_code: str | None = None,
) -> dict[str, Any] | None:
    normalized_address = address.strip()
    if not normalized_address:
        raise ValueError("address must not be empty.")

    query_params: dict[str, Any] = {
        "address": normalized_address,
        "language": language_code,
    }
    if region_code:
        query_params["region"] = region_code

    payload = _load_geocode_json(query_params)

    status = payload.get("status")
    if status == "ZERO_RESULTS":
        logger.warning(f"No geocoding results found for address: {normalized_address}")
        return None
    if status != "OK":
        logger.error(f"Google geocoding failed with status: {status}")
        raise RuntimeError(f"Google geocoding failed with status: {status}")

    results = payload.get("results", [])
    if not results:
        return None

    top_result = _normalize_geocode_result(results[0])
    return {
        "query_address": normalized_address,
        **top_result,
        "raw_results_count": len(results),
    }