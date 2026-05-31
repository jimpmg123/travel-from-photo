from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass(frozen=True)
class LoungeTag:
    tag_key: str
    display_name: str
    emoji: str
    description: str
    category: str


LOUNGE_TAGS: list[LoungeTag] = [
    LoungeTag("beach", "Beach & Coast", "🏖", "Beach, coast, islands, ocean, and seaside trips.", "nature"),
    LoungeTag("mountain", "Mountain & Hike", "🏔", "Mountains, hiking trails, highlands, and trekking photos.", "nature"),
    LoungeTag("nature", "Nature & Wildlife", "🌲", "Forests, lakes, wildlife, parks, and natural scenery.", "nature"),
    LoungeTag("desert", "Desert & Plains", "🏜", "Deserts, plains, grasslands, and wide open landscapes.", "nature"),
    LoungeTag("urban", "Urban & Street", "🌆", "City streets, skylines, neighborhoods, and street views.", "urban"),
    LoungeTag("historical", "Historical & Heritage", "🏛", "Historic places, palaces, temples, castles, and heritage sites.", "urban"),
    LoungeTag("nightlife", "Nightlife & Lights", "🌃", "Night views, neon signs, evening streets, and city lights.", "urban"),
    LoungeTag("food", "Food & Cafe", "🍜", "Meals, cafes, restaurants, bakeries, and local food photos.", "culture"),
    LoungeTag("museum", "Museum & Art", "🎨", "Museums, art galleries, exhibitions, murals, and creative spaces.", "culture"),
    LoungeTag("market", "Market & Shopping", "🛍", "Markets, shopping streets, stores, malls, and souvenirs.", "culture"),
    LoungeTag("transport", "Transport & Journey", "🚆", "Trains, bridges, airports, roads, stations, and transit moments.", "experience"),
    LoungeTag("sunset", "Sunset & Sunrise", "🌅", "Sunrise, sunset, golden hour, dusk, and dawn scenes.", "experience"),
    LoungeTag("snow", "Snow & Winter", "☃️", "Snow, winter travel, ski trips, ice, and cold landscapes.", "experience"),
]

TAG_BY_KEY = {tag.tag_key: tag for tag in LOUNGE_TAGS}

KEYWORD_TO_TAG: dict[str, str] = {
    # Beach & Coast
    "beach": "beach", "coast": "beach", "coastal": "beach", "ocean": "beach", "sea": "beach",
    "seaside": "beach", "shore": "beach", "island": "beach", "harbor": "beach", "harbour": "beach",
    "port": "beach", "pier": "beach", "marina": "beach", "bay": "beach",
    # Mountain & Hike
    "mountain": "mountain", "mountains": "mountain", "hiking": "mountain", "hike": "mountain",
    "trail": "mountain", "trekking": "mountain", "alps": "mountain", "highland": "mountain",
    "peak": "mountain", "cliff": "mountain", "valley": "mountain",
    # Nature & Wildlife
    "forest": "nature", "woods": "nature", "lake": "nature", "river": "nature", "waterfall": "nature",
    "wildlife": "nature", "animal": "nature", "park": "nature", "garden": "nature", "tree": "nature",
    "nature": "nature", "botanical": "nature", "vegetation": "nature",
    # Desert & Plains
    "desert": "desert", "sand": "desert", "dune": "desert", "plains": "desert", "plain": "desert",
    "grassland": "desert", "savanna": "desert", "prairie": "desert",
    # Urban & Street
    "urban": "urban", "street": "urban", "city": "urban", "downtown": "urban", "skyline": "urban",
    "skyscraper": "urban", "building": "urban", "neighborhood": "urban", "road": "urban", "alley": "urban",
    "plaza": "urban", "square": "urban", "architecture": "urban",
    # Historical & Heritage
    "historical": "historical", "history": "historical", "heritage": "historical", "landmark": "historical",
    "palace": "historical", "temple": "historical", "castle": "historical", "church": "historical",
    "cathedral": "historical", "monument": "historical", "ruins": "historical", "shrine": "historical",
    "museum building": "historical", "eiffel": "historical", "tower": "historical",
    # Nightlife & Lights
    "night": "nightlife", "nightlife": "nightlife", "neon": "nightlife", "lights": "nightlife",
    "night view": "nightlife", "night market": "nightlife", "bar": "nightlife", "club": "nightlife",
    # Food & Cafe
    "food": "food", "restaurant": "food", "cafe": "food", "caf\u00e9": "food", "coffee": "food", "meal": "food",
    "ramen": "food", "sushi": "food", "bakery": "food", "dessert": "food", "dish": "food",
    "dining": "food", "bistro": "food", "menu": "food",
    # Museum & Art
    "museum": "museum", "art": "museum", "gallery": "museum", "exhibition": "museum", "mural": "museum",
    "painting": "museum", "sculpture": "museum", "artwork": "museum",
    # Market & Shopping
    "market": "market", "shopping": "market", "shop": "market", "store": "market", "mall": "market",
    "souvenir": "market", "vendor": "market", "bazaar": "market",
    # Transport & Journey
    "transport": "transport", "train": "transport", "station": "transport", "subway": "transport", "metro": "transport",
    "bridge": "transport", "airport": "transport", "bus": "transport", "tram": "transport", "journey": "transport",
    "railway": "transport", "ticket": "transport", "ferry": "transport",
    # Sunset & Sunrise
    "sunset": "sunset", "sunrise": "sunset", "dawn": "sunset", "dusk": "sunset", "golden hour": "sunset",
    "twilight": "sunset",
    # Snow & Winter
    "snow": "snow", "winter": "snow", "ski": "snow", "skiing": "snow", "ice": "snow", "frozen": "snow",
    "cold": "snow", "glacier": "snow",
}


def lounge_dict(tag: LoungeTag) -> dict[str, str]:
    return asdict(tag)


def standard_lounges() -> list[dict[str, str]]:
    return [lounge_dict(tag) for tag in LOUNGE_TAGS]


def _collect_strings(value: Any) -> list[str]:
    """Flatten a nested search-analysis payload into short searchable strings."""
    out: list[str] = []
    if value is None:
        return out
    if isinstance(value, str):
        if value.strip():
            out.append(value.strip())
        return out
    if isinstance(value, (int, float, bool)):
        return out
    if isinstance(value, list):
        for item in value[:80]:
            out.extend(_collect_strings(item))
        return out
    if isinstance(value, dict):
        # Keep the fields most likely to contain labels, place types, OCR text, or scene summaries.
        preferred_keys = {
            "label", "labels", "description", "descriptions", "scene_type", "vegetation",
            "architecture", "types", "type", "place_name", "formatted_address", "country", "city",
            "reasoning", "reason", "text", "best_guess", "best_guess_labels", "parsed_place_name",
            "source", "notes", "summary", "candidate_name", "region", "metadata",
        }
        for key, item in value.items():
            if key in preferred_keys or isinstance(item, (dict, list)):
                out.extend(_collect_strings(item))
        return out
    return out


def normalize_lounge_tags(payload: dict[str, Any], *, max_tags: int = 3) -> list[str]:
    """Map raw Vision/GPT/Places clues into 1-3 standard lounge tag keys.

    The function is intentionally deterministic and simple so Search and Chat can share it.
    It can digest labels, GPT scene fields, Places types, OCR strings, and candidate reasons.
    """
    text_blob = " \n ".join(_collect_strings(payload)).lower()
    scores: dict[str, int] = {tag.tag_key: 0 for tag in LOUNGE_TAGS}

    for keyword, tag_key in KEYWORD_TO_TAG.items():
        if keyword in text_blob:
            # Slightly reward more specific phrases.
            scores[tag_key] += 2 if " " in keyword else 1

    # Small contextual boosts.
    if any(word in text_blob for word in ["restaurant", "cafe", "meal", "dish"]):
        scores["food"] += 2
    if any(word in text_blob for word in ["landmark", "monument", "palace", "temple", "castle"]):
        scores["historical"] += 2
    if any(word in text_blob for word in ["city", "street", "building", "architecture"]):
        scores["urban"] += 1

    ranked = [key for key, score in sorted(scores.items(), key=lambda item: (-item[1], item[0])) if score > 0]
    if not ranked:
        ranked = ["urban"]
    return ranked[:max_tags]


def lounge_payload_for_tags(tag_keys: list[str]) -> list[dict[str, str]]:
    return [lounge_dict(TAG_BY_KEY[key]) for key in tag_keys if key in TAG_BY_KEY]
