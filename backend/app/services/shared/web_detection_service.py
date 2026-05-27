from __future__ import annotations

import base64
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import GOOGLE_CLOUD_VISION_API_KEY

VISION_ANNOTATE_URL = "https://vision.googleapis.com/v1/images:annotate"


def _require_api_key() -> str:
    if not GOOGLE_CLOUD_VISION_API_KEY:
        raise RuntimeError(
            "GOOGLE_CLOUD_VISION_API_KEY is not set. Add it to backend/.env or rely on GOOGLE_MAPS_API_KEY fallback."
        )
    return GOOGLE_CLOUD_VISION_API_KEY


def _build_request(image_bytes: bytes, max_results: int) -> dict:
    return {
        "requests": [
            {
                "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
                "features": [{"type": "WEB_DETECTION", "maxResults": max_results}],
            }
        ]
    }


def analyze_web_detection(
    image_path: str | Path,
    max_results: int = 10,
    include_raw_response: bool = False,
) -> dict:
    """Google Cloud Vision Web Detection — reverse image search.

    Returns Google's best guess for what the photo shows plus related web
    entities and pages where the same image appears. Mechanism is totally
    different from Landmark / OCR / Logo (it's index lookup, not vision
    inference), so an agreement here is strong evidence of independence.

    IMPORTANT: this API is called on the ORIGINAL image (not preprocessed).
    Contrast/sharpening modifications can break index matching."""
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    api_key = _require_api_key()
    request = Request(
        f"{VISION_ANNOTATE_URL}?key={api_key}",
        data=json.dumps(_build_request(path.read_bytes(), max_results)).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            raw_response = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Cloud Vision Web Detection failed HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Cloud Vision Web Detection request failed: {exc}") from exc

    responses = raw_response.get("responses", [])
    if not responses:
        raise RuntimeError("Cloud Vision Web Detection returned no responses.")
    payload = responses[0]
    if "error" in payload:
        raise RuntimeError(f"Cloud Vision Web Detection failed: {payload['error']}")

    web = payload.get("webDetection") or {}
    web_entities = [
        {
            "description": entity.get("description"),
            "score": entity.get("score"),
            "entity_id": entity.get("entityId"),
        }
        for entity in web.get("webEntities", [])
    ]
    best_guess_labels = [item.get("label") for item in web.get("bestGuessLabels", []) if item.get("label")]
    pages = [
        {"url": page.get("url"), "page_title": page.get("pageTitle")}
        for page in web.get("pagesWithMatchingImages", [])
    ]

    result = {
        "file_name": path.name,
        "absolute_path": str(path.resolve()),
        "best_guess": best_guess_labels[0] if best_guess_labels else None,
        "best_guess_labels": best_guess_labels,
        "top_web_entity": web_entities[0] if web_entities else None,
        "web_entities": web_entities,
        "pages_with_matching_images": pages,
        "full_matching_images_count": len(web.get("fullMatchingImages", [])),
        "partial_matching_images_count": len(web.get("partialMatchingImages", [])),
    }
    if include_raw_response:
        result["raw_response"] = raw_response
    return result
