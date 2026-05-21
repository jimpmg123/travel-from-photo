from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import GOOGLE_CLOUD_VISION_API_KEY

VISION_ANNOTATE_URL = "https://vision.googleapis.com/v1/images:annotate"


def _require_api_key() -> str:
    if not GOOGLE_CLOUD_VISION_API_KEY:
        raise RuntimeError(
            "GOOGLE_CLOUD_VISION_API_KEY is not set. Add it to backend/.env."
        )
    return GOOGLE_CLOUD_VISION_API_KEY


def analyze_object_localization(
    image_path: str | Path,
    max_results: int = 15,
) -> dict[str, Any]:
    """Google Vision OBJECT_LOCALIZATION — named objects with bounding boxes.
    Helps distinguish "Eiffel Tower photo" vs "tower-shaped object next to a
    bridge", supporting Case 3 (full conflict) disambiguation."""

    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    api_key = _require_api_key()
    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(path.read_bytes()).decode("ascii")},
                "features": [{"type": "OBJECT_LOCALIZATION", "maxResults": max_results}],
            }
        ]
    }
    request = Request(
        f"{VISION_ANNOTATE_URL}?key={api_key}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Vision OBJECT_LOCALIZATION HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Vision OBJECT_LOCALIZATION failed: {exc}") from exc

    response_payload = (raw.get("responses") or [{}])[0]
    if "error" in response_payload:
        raise RuntimeError(f"Vision OBJECT_LOCALIZATION error: {response_payload['error']}")

    annotations = response_payload.get("localizedObjectAnnotations") or []
    objects = [
        {
            "name": item.get("name"),
            "score": item.get("score"),
            "bounding_poly": item.get("boundingPoly"),
        }
        for item in annotations
    ]
    return {
        "file_name": path.name,
        "objects": objects,
        "top_object": objects[0] if objects else None,
    }
