from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.shared.geocoding_service import reverse_geocode_coordinates

router = APIRouter(tags=["geocode"])


class ReverseGeocodeResponse(BaseModel):
    place_name: str | None
    formatted_address: str | None
    city: str | None
    country: str | None
    latitude: float | None
    longitude: float | None


@router.get("/geocode/reverse", response_model=ReverseGeocodeResponse)
def reverse_geocode(
    lat: float = Query(...),
    lng: float = Query(...),
):
    try:
        result = reverse_geocode_coordinates(lat, lng)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding failed: {exc}")

    if not result:
        return ReverseGeocodeResponse(
            place_name=None,
            formatted_address=None,
            city=None,
            country=None,
            latitude=lat,
            longitude=lng,
        )

    formatted = result.get("formatted_address")
    place_name = formatted.split(",")[0].strip() if formatted else None

    return ReverseGeocodeResponse(
        place_name=place_name,
        formatted_address=formatted,
        city=result.get("city"),
        country=result.get("country"),
        latitude=result.get("latitude") or lat,
        longitude=result.get("longitude") or lng,
    )
