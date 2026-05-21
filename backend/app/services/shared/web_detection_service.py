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


def analyze_web_detection(
    image_path: str | Path,
    max_results: int = 10,
) -> dict[str, Any]:
    """Google Vision WEB_DETECTION — reverse-image-search hits across the web,
    plus best-guess labels. Often returns the strongest signal for known
    landmarks / shops because it surfaces matching pages and place names."""

    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")

    api_key = _require_api_key()
    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(path.read_bytes()).decode("ascii")},
                "features": [{"type": "WEB_DETECTION", "maxResults": max_results}],
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
        raise RuntimeError(f"Vision WEB_DETECTION HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Vision WEB_DETECTION failed: {exc}") from exc

    response_payload = (raw.get("responses") or [{}])[0]
    if "error" in response_payload:
        raise RuntimeError(f"Vision WEB_DETECTION error: {response_payload['error']}")

    web = response_payload.get("webDetection") or {}
    best_guess_labels = [
        {"label": entry.get("label"), "language_code": entry.get("languageCode")}
        for entry in web.get("bestGuessLabels") or []
    ]
    web_entities = [
        {
            "description": entry.get("description"),
            "score": entry.get("score"),
            "entity_id": entry.get("entityId"),
        }
        for entry in web.get("webEntities") or []
    ]
    pages_with_matches = [
        page.get("pageTitle") for page in web.get("pagesWithMatchingImages") or [] if page.get("pageTitle")
    ]

    return {
        "file_name": path.name,
        "best_guess_labels": best_guess_labels,
        "web_entities": web_entities,
        "pages_with_matching_images": pages_with_matches[:max_results],
        "best_guess": best_guess_labels[0]["label"] if best_guess_labels else None,
    }
