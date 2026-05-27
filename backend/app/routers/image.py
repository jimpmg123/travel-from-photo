import shutil
from pathlib import Path

from fastapi import APIRouter, File, UploadFile

from app.services.search.image_ingestion_service import ingest_uploaded_file
from app.services.shared.clip_service import analyze_image_by_axes
from app.services.shared.geocoding_service import reverse_geocode_coordinates

router = APIRouter()


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    temp_path = Path(f"temp_{file.filename}")

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        await file.seek(0)

        metadata = await ingest_uploaded_file(file)
        result_data = metadata.model_dump() if hasattr(metadata, "model_dump") else dict(metadata)

        gps = result_data.get("gps")
        has_gps = gps is not None and gps.get("latitude") is not None and gps.get("longitude") is not None

        if has_gps:
            try:
                reverse_result = reverse_geocode_coordinates(
                    gps["latitude"],
                    gps["longitude"],
                    language_code="en",
                )
                result_data["city"] = reverse_result.get("city") or reverse_result.get("region") or "Unknown Region"
            except Exception as exc:
                print(f"[Error] Reverse geocoding failed: {exc}")
                result_data["city"] = "Geocoding Failed"
        else:
            result_data["city"] = "Unknown Location"

        try:
            clip_result = analyze_image_by_axes(temp_path)
            result_data["summary"] = clip_result.get("summary") if isinstance(clip_result, dict) else clip_result
        except Exception as exc:
            print(f"[Error] CLIP analysis failed: {exc}")
            result_data["summary"] = None

        return result_data
    finally:
        temp_path.unlink(missing_ok=True)
