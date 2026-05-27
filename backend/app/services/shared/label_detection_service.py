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
                "features": [{"type": "LABEL_DETECTION", "maxResults": max_results}],
            }
        ]
    }


def analyze_label_detection(
    image_path: str | Path,
    max_results: int = 10,
    include_raw_response: bool = False,
) -> dict:
    """Google Cloud Vision Label Detection — broad scene/object tags like
    'Temple', 'Tree', 'Sky'. Useful as a scene-only signal (not place)."""
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
        raise RuntimeError(f"Cloud Vision Label Detection failed HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Cloud Vision Label Detection request failed: {exc}") from exc

    responses = raw_response.get("responses", [])
    if not responses:
        raise RuntimeError("Cloud Vision Label Detection returned no responses.")
    payload = responses[0]
    if "error" in payload:
        raise RuntimeError(f"Cloud Vision Label Detection failed: {payload['error']}")

    labels = [
        {
            "description": item.get("description"),
            "score": item.get("score"),
            "mid": item.get("mid"),
            "topicality": item.get("topicality"),
        }
        for item in payload.get("labelAnnotations", [])
    ]

    result = {
        "file_name": path.name,
        "absolute_path": str(path.resolve()),
        "top_label": labels[0] if labels else None,
        "labels": labels,
    }
    if include_raw_response:
        result["raw_response"] = raw_response
    return result
