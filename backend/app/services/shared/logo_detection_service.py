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


def analyze_logo_detection(
    image_path: str | Path,
    max_results: int = 10,
) -> dict[str, Any]:
    """Google Vision LOGO_DETECTION — recognizes brand/franchise logos.
    Strong signal for Case 2 (Blue Bottle, Starbucks etc.) — narrows the
    candidate set to one franchise across multiple branches."""

    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    api_key = _require_api_key()
    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(path.read_bytes()).decode("ascii")},
                "features": [{"type": "LOGO_DETECTION", "maxResults": max_results}],
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
        raise RuntimeError(f"Vision LOGO_DETECTION HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Vision LOGO_DETECTION failed: {exc}") from exc

    response_payload = (raw.get("responses") or [{}])[0]
    if "error" in response_payload:
        raise RuntimeError(f"Vision LOGO_DETECTION error: {response_payload['error']}")

    annotations = response_payload.get("logoAnnotations") or []
    logos = [
        {
            "description": item.get("description"),
            "score": item.get("score"),
            "mid": item.get("mid"),
        }
        for item in annotations
    ]
    return {
        "file_name": path.name,
        "logos": logos,
        "top_logo": logos[0] if logos else None,
    }
