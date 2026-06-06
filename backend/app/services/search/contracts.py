from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


GOOGLE_LANGUAGE_CODES: dict[str, str] = {
    "ko": "ko", "en": "en", "ja": "ja", "zh": "zh-CN",
    "es": "es", "fr": "fr", "de": "de", "pt": "pt", "it": "it", "ru": "ru",
}

LANGUAGE_NAMES: dict[str, str] = {
    "ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Chinese",
    "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese",
    "it": "Italian", "ru": "Russian",
}


@dataclass(slots=True)
class SearchHintContext:
    country_hint: str | None = None
    city_hint: str | None = None
    user_hint: str | None = None
    language: str = "en"

    def normalized_country(self) -> str | None:
        value = (self.country_hint or "").strip()
        return value or None

    def normalized_city(self) -> str | None:
        value = (self.city_hint or "").strip()
        return value or None

    def normalized_user_hint(self) -> str | None:
        value = (self.user_hint or "").strip()
        return value or None

    def google_language_code(self) -> str:
        return GOOGLE_LANGUAGE_CODES.get(self.language, "en")

    def language_name(self) -> str:
        return LANGUAGE_NAMES.get(self.language, "English")


@dataclass(slots=True)
class SearchLocationResolution:
    status: str
    source: str | None
    latitude: float | None
    longitude: float | None
    formatted_address: str | None
    country: str | None
    city: str | None
    region: str | None
    place_name: str | None = None
    failure_reason: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# Tiered-flow types (Tier 0/1/2/3). Used by the new signal-fusion pipeline.
# Lists in the dataclasses below are kept as `list[dict[str, Any]]` rather
# than nested dataclasses so they round-trip through JSON / DB JSON columns
# without extra serialization steps. The dataclasses are still useful as
# typed builders — call `.to_dict()` when assembling these lists.
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class RawSignal:
    """One normalized response from a single helper (Vision API / GPT / EXIF).

    `source` examples: exif_gps, vision_landmark, vision_ocr, vision_web,
    vision_logo, vision_label, vision_object, gpt4o_main, gpt4o_arbiter.
    `tier` records which tier produced this signal so it's easy to inspect.
    """

    source: str
    status: str  # resolved | empty | failed | skipped
    raw_response: dict[str, Any] | None = None
    parsed_place_name: str | None = None
    parsed_country: str | None = None
    parsed_city: str | None = None
    parsed_latitude: float | None = None
    parsed_longitude: float | None = None
    signal_score: float | None = None
    failure_reason: str | None = None
    latency_ms: int | None = None
    tier: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class Candidate:
    """A location candidate, possibly merged from many signals.

    `address_components` is filled by the Places/Geocoding step and is what
    enables hierarchical merge ("Eiffel Tower ⊂ Champ de Mars ⊂ Paris").
    """

    rank: int = 0
    place_name: str | None = None
    formatted_address: str | None = None
    country: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    google_place_id: str | None = None
    address_components: list[dict[str, Any]] = field(default_factory=list)
    aggregated_score: float | None = None
    contributing_sources: list[str] = field(default_factory=list)
    member_signal_scores: list[dict[str, Any]] = field(default_factory=list)
    reasoning: str | None = None
    is_selected: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class TierResult:
    """Output of one tier of the pipeline.

    `stop_here` is the key flag: when a tier produces strong-enough evidence
    (e.g., Tier 0 GPS sanity passes, or Tier 1 reaches consensus), it sets
    stop_here=True and the orchestrator returns without escalating.
    """

    tier: int
    name: str
    signals: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    verdict: str | None = None  # confident | likely | suggestions | failed | inconclusive
    stop_here: bool = False
    elapsed_ms: int | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class FusionResult:
    """Final aggregated output after all tiers that actually ran."""

    signals: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    verdict: str | None = None
    tier_reached: int = 0
    tier_trace: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SearchImageAnalysis:
    file_name: str
    absolute_path: str | None
    file_size_bytes: int
    image: dict[str, Any]
    captured_at: str | None
    camera: dict[str, Any]
    gps: dict[str, Any] | None
    has_gps: bool
    metadata_case: str
    exif_summary: dict[str, Any]
    summary: Any = None
    city: str | None = None
    resolution_status: str = "failed"
    resolution_source: str | None = None
    failure_reason: str | None = None
    resolved_location: dict[str, Any] | None = None
    clip_gate: dict[str, Any] | None = None
    clip_scene_hints: list[dict[str, Any]] = field(default_factory=list)
    landmark_candidate: dict[str, Any] | None = None
    openai_candidate: dict[str, Any] | None = None
    hint_context: dict[str, Any] = field(default_factory=dict)
    # Tiered-flow additions. These coexist with the cascade fields above so
    # the response is backward-compatible while we publish the new structure.
    signals: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    verdict: str | None = None
    preprocessing: dict[str, Any] = field(default_factory=dict)
    tier_reached: int = 0
    tier_trace: list[dict[str, Any]] = field(default_factory=list)

    def apply_resolution(self, resolution: SearchLocationResolution) -> None:
        self.resolution_status = resolution.status
        self.resolution_source = resolution.source
        self.failure_reason = resolution.failure_reason
        self.city = resolution.city or self.city
        self.resolved_location = resolution.to_dict()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
