"""CLIP-based categorical tagging for Journal entries (statistics-only backup).

Axis A — subject: single-label softmax over an 8-label vocabulary. Top label wins
unless its softmax probability is below SUBJECT_THRESHOLD, in which case the
photo is marked 'uncategorized'.

Axis B — atmosphere: 8 binary "showing X vs not showing X" softmax pairs. Each
theme is decided independently; the positive side must exceed ATMOSPHERE_THRESHOLD
to be adopted. This avoids forcing one-hot semantics on themes that can co-exist
(e.g. nighttime AND crowded).

The bipolar approach lets multiple themes adopt simultaneously, which is the
whole point — softmaxing 8 themes against each other would arbitrarily make
their probabilities sum to 1 and break multi-label semantics.
"""
from __future__ import annotations

from pathlib import Path

from app.services.shared.clip_service import _score_image_against_labels

# Bump this whenever SUBJECT_LABELS_V1 / ATMOSPHERE_LABELS_V1 change.
CLIP_VOCAB_VERSION = "v1"

# Axis A — subject of the photo (single label).
SUBJECT_LABELS_V1 = [
    "food or drink",
    "landscape or nature scenery",
    "architecture or a building",
    "people or a crowd",
    "night scene with artificial lights",
    "transportation or a vehicle",
    "indoor space or interior",
    "abstract patterns or textures",
]

# Axis B — atmosphere (multi-label, independent bipolar decision).
ATMOSPHERE_LABELS_V1 = [
    "crowded or busy",
    "empty or solitary",
    "daytime",
    "nighttime",
    "indoor",
    "outdoor",
    "rainy or foggy or overcast",
    "clear or sunny",
]

# Below this softmax probability, the top subject is treated as too weak to trust.
SUBJECT_THRESHOLD = 0.25
# Positive side of the bipolar pair must exceed this for the theme to be adopted.
ATMOSPHERE_THRESHOLD = 0.6

SUBJECT_UNCATEGORIZED = "uncategorized"


def _slug(text: str) -> str:
    """Convert a human label ('food or drink') into a stable DB-friendly key
    ('food_or_drink'). Replaces spaces with underscores; preserves the 'or'
    connective. Kept tiny on purpose — vocabulary changes are rare and bumping
    CLIP_VOCAB_VERSION already signals a break."""
    return text.replace(" ", "_").lower()


def classify_subject(image_path: str | Path) -> tuple[str, float]:
    """Axis A — return (slug, softmax_confidence). Falls back to 'uncategorized'
    when the top label is below the trust threshold."""
    result = _score_image_against_labels(
        image_path=image_path,
        labels=SUBJECT_LABELS_V1,
        prompt_template="a photo of {label}",
        top_k=len(SUBJECT_LABELS_V1),
    )
    top = result["top_match"]
    score = float(top["score"])
    if score < SUBJECT_THRESHOLD:
        return SUBJECT_UNCATEGORIZED, score
    return _slug(top["label"]), score


def classify_atmosphere(image_path: str | Path) -> list[str]:
    """Axis B — independent bipolar decision per theme. Returns slugs of every
    theme whose positive side exceeds ATMOSPHERE_THRESHOLD."""
    adopted: list[str] = []
    for theme in ATMOSPHERE_LABELS_V1:
        positive = f"a photo showing {theme}"
        negative = f"a photo not showing {theme}"
        result = _score_image_against_labels(
            image_path=image_path,
            labels=[positive, negative],
            prompt_template="{label}",  # labels are already full prompts
            top_k=2,
        )
        pos_score = 0.0
        for match in result["matches"]:
            if match["label"] == positive:
                pos_score = float(match["score"])
                break
        if pos_score > ATMOSPHERE_THRESHOLD:
            adopted.append(_slug(theme))
    return adopted
