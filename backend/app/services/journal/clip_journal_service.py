"""CLIP-based categorical tagging for Journal entries (statistics-only).

V3 — three axes, all bipolar multi-label:
  Axis A — Subject (43 labels)       — "what was photographed?"   threshold 0.50
  Axis B — Style / Atmosphere (37)   — "what mood and composition?"
                                       tiered: objective 0.60, subjective 0.45
  Axis C — Activity / Action (24)    — "what was someone doing?"  threshold 0.50

Every label is decided independently via a bipolar pair softmax
("a photo showing X" vs "a photo not showing X") because tags can co-exist
on the same photo (e.g. eating + cafe interior + warm golden hour).

Tiered thresholds are the spec's pragmatic answer to CLIP being structurally
less confident about subjective concepts (mood/atmosphere) than objective
ones (composition/lighting). One threshold for all 80+ labels would either
flood the entry with noisy objective tags or starve it of legitimate
subjective ones — splitting into two groups solves both ends at once.

Vocab/version bump rule: any edit to the lists below MUST increment
CLIP_VOCAB_VERSION so cached tags and prior journal_entries remain
interpretable (stats queries can filter by vocab_version to keep tag
distributions consistent across vocab generations).
"""
from __future__ import annotations

from pathlib import Path

from app.services.shared.clip_service import _score_image_against_labels

CLIP_VOCAB_VERSION = "v3"

# ---------- Axis A — Subject (43, bipolar multi) ----------

MICRO_SUBJECT_LABELS_V3: list[str] = [
    # Food / drink (7)
    "a plate of food close-up",
    "a spread of multiple dishes on a table",
    "a beverage or drink",
    "a street food vendor",
    "traditional cuisine being served",
    "a dessert or pastry",
    "a cooking or kitchen scene",
    # Architecture (7)
    "a temple, shrine, or religious building",
    "a modern skyscraper or office tower",
    "a traditional house or historic dwelling",
    "a stone monument or statue",
    "a bridge across water or road",
    "a tall tower or observation deck",
    "an ornate building facade with detail",
    # Nature (7)
    "a mountain range or peak",
    "a forest or grove of trees",
    "a beach or coastline",
    "a river, lake, or waterfront",
    "a flower or plant close-up",
    "a waterfall",
    "a desert or open field",
    # People (5)
    "a single person portrait",
    "a crowd of many people",
    "a person walking from behind",
    "people in traditional clothing",
    "a couple or pair of people",
    # Transport (4)
    "a train or subway car",
    "a bus or road vehicle",
    "a boat or ship on water",
    "a bicycle or scooter",
    # Signage / text (3)
    "a street sign or directional sign",
    "a shop sign or storefront name",
    "a museum exhibit label or plaque",
    # Interior (4)
    "a cafe or restaurant interior",
    "a hotel or guesthouse room interior",
    "a museum or gallery interior",
    "a shop or boutique interior",
    # Abstract / other (6)
    "a close-up texture or surface pattern",
    "an abstract reflection in glass or water",
    "a window or doorway as frame",
    "a market stall scene",
    "a night market with neon",
    "a festival or event crowd scene",
]
assert len(MICRO_SUBJECT_LABELS_V3) == 43, "subject vocab must stay 43 labels"


# ---------- Axis B — Style / Atmosphere (37, tiered bipolar multi) ----------

# Objective tier — composition / light / weather / time. CLIP can judge these
# mechanically, so strict threshold keeps noisy tags off.
OBJECTIVE_STYLE_LABELS_V3: list[str] = [
    # Composition (6)
    "symmetrical composition",
    "leading lines composition",
    "rule of thirds composition",
    "centered subject framing",
    "framing within a frame",
    "minimalist composition with negative space",
    # Lighting (5)
    "soft natural light",
    "harsh direct sunlight",
    "artificial neon or signage light",
    "backlit silhouette",
    "high shadow and contrast",
    # Time of day (5)
    "bright daytime",
    "dark nighttime",
    "warm golden hour",
    "cool blue hour twilight",
    "diffused overcast light",
    # Weather (4)
    "clear sky",
    "cloudy or overcast sky",
    "rain or wet surfaces",
    "fog or mist in the air",
]
assert len(OBJECTIVE_STYLE_LABELS_V3) == 20, "objective tier must stay 20 labels"

# Subjective tier — atmosphere / mood / cultural feel. CLIP is mathematically
# less confident here even when the concept is visually present, so the
# threshold is relaxed.
SUBJECTIVE_STYLE_LABELS_V3: list[str] = [
    # Atmosphere (6)
    "a crowded busy scene",
    "an empty solitary scene",
    "a bustling lively scene",
    "a quiet peaceful scene",
    "a chaotic energetic scene",
    "an intimate cozy scene",
    # Mood (6)
    "a nostalgic feeling",
    "a mysterious moody feeling",
    "a romantic dreamy feeling",
    "a joyful uplifting feeling",
    "a melancholic feeling",
    "a contemplative feeling",
    # Cultural feel (5)
    "local everyday life",
    "a touristy spot",
    "historical heritage feel",
    "a modern commercial setting",
    "a spiritual or sacred atmosphere",
]
assert len(SUBJECTIVE_STYLE_LABELS_V3) == 17, "subjective tier must stay 17 labels"

MICRO_STYLE_LABELS_V3: list[str] = OBJECTIVE_STYLE_LABELS_V3 + SUBJECTIVE_STYLE_LABELS_V3
assert len(MICRO_STYLE_LABELS_V3) == 37, "style vocab must stay 37 labels"


# ---------- Axis C — Activity / Action (24, bipolar multi) ----------

MICRO_ACTIVITY_LABELS_V3: list[str] = [
    # Gastronomy (4)
    "dining or eating at a restaurant",
    "enjoying street food or a night market",
    "drinking coffee or tea at a cafe",
    "cooking or preparing a meal",
    # Exploration (4)
    "sightseeing at a famous landmark",
    "wandering and exploring city streets",
    "visiting a museum, gallery, or exhibit",
    "shopping or browsing local stores",
    # Leisure (4)
    "relaxing or resting indoors",
    "chilling at a beach or park",
    "enjoying a spa, pool, or hot spring",
    "reading, journaling, or working on a laptop",
    # Active / nature (4)
    "hiking, trekking, or walking in nature",
    "swimming or doing water sports",
    "camping or outdoor adventure",
    "doing winter sports like skiing",
    # Transit (4)
    "riding public transit like train or subway",
    "waiting at an airport or taking a flight",
    "driving or being on a road trip",
    "walking, running, or cycling",
    # Culture / social (4)
    "attending a festival, concert, or event",
    "experiencing local or traditional culture",
    "hanging out with friends or family",
    "watching a performance or sports game",
]
assert len(MICRO_ACTIVITY_LABELS_V3) == 24, "activity vocab must stay 24 labels"


# ---------- Thresholds (tiered per spec consideration #1) ----------

SUBJECT_THRESHOLD = 0.50        # Axis A — bipolar multi
OBJECTIVE_THRESHOLD = 0.60      # Axis B objective — strict
SUBJECTIVE_THRESHOLD = 0.45     # Axis B subjective — permissive
ACTIVITY_THRESHOLD = 0.50       # Axis C — bipolar multi


# ---------- Helpers ----------

def _slug(text: str) -> str:
    """Stable DB key for a human label. Drops common filler words and
    converts spaces to underscores. Keep slugs close to the human phrase so
    debug dumps stay readable."""
    cleaned = (
        text.lower()
        .replace("a photo of ", "")
        .replace("a photo showing ", "")
        .replace("a photo showing someone ", "")
        .replace("a ", "")
        .replace("an ", "")
        .strip()
    )
    return cleaned.replace(",", "").replace(" ", "_")


def _classify_one_bipolar(image_path: str | Path, positive: str, negative: str, threshold: float) -> bool:
    """One bipolar contrast — pos vs neg softmax pair for a single theme."""
    result = _score_image_against_labels(
        image_path=image_path,
        labels=[positive, negative],
        prompt_template="{label}",  # labels already full prompts
        top_k=2,
    )
    pos_score = 0.0
    for match in result["matches"]:
        if match["label"] == positive:
            pos_score = float(match["score"])
            break
    return pos_score > threshold


# ---------- Public API ----------

def classify_subject(image_path: str | Path) -> list[str]:
    """Axis A — bipolar multi over 43 subject labels. Returns slugs of every
    subject above SUBJECT_THRESHOLD."""
    adopted: list[str] = []
    for subject in MICRO_SUBJECT_LABELS_V3:
        positive = f"a photo of {subject}"
        negative = f"a photo not showing {subject}"
        if _classify_one_bipolar(image_path, positive, negative, SUBJECT_THRESHOLD):
            adopted.append(_slug(subject))
    return adopted


def classify_atmosphere(image_path: str | Path) -> list[str]:
    """Axis B — tiered bipolar multi. Objective labels use strict threshold,
    subjective labels use permissive threshold."""
    adopted: list[str] = []

    for theme in OBJECTIVE_STYLE_LABELS_V3:
        positive = f"a photo showing {theme}"
        negative = f"a photo not showing {theme}"
        if _classify_one_bipolar(image_path, positive, negative, OBJECTIVE_THRESHOLD):
            adopted.append(_slug(theme))

    for theme in SUBJECTIVE_STYLE_LABELS_V3:
        positive = f"a photo showing {theme}"
        negative = f"a photo not showing {theme}"
        if _classify_one_bipolar(image_path, positive, negative, SUBJECTIVE_THRESHOLD):
            adopted.append(_slug(theme))

    return adopted


def classify_activity(image_path: str | Path) -> list[str]:
    """Axis C — bipolar multi over 24 activity labels. Returns slugs of every
    activity above ACTIVITY_THRESHOLD."""
    adopted: list[str] = []
    for activity in MICRO_ACTIVITY_LABELS_V3:
        positive = f"a photo showing someone {activity}"
        negative = f"a photo not showing someone {activity}"
        if _classify_one_bipolar(image_path, positive, negative, ACTIVITY_THRESHOLD):
            adopted.append(_slug(activity))
    return adopted
