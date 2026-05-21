from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class SearchHintContext:
    country_hint: str | None = None
    city_hint: str | None = None
    user_hint: str | None = None

    def normalized_country(self) -> str | None:
        value = (self.country_hint or "").strip()
        return value or None

    def normalized_city(self) -> str | None:
        value = (self.city_hint or "").strip()
        return value or None

    def normalized_user_hint(self) -> str | None:
        value = (self.user_hint or "").strip()
        return value or None


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
    # Fusion-flow additions. Each signal is one helper's raw answer + parsed
    # fields; each candidate is one place that one or more signals agree on.
    signals: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    verdict: str | None = None
    preprocessing: dict[str, Any] = field(default_factory=dict)

    def apply_resolution(self, resolution: SearchLocationResolution) -> None:
        self.resolution_status = resolution.status
        self.resolution_source = resolution.source
        self.failure_reason = resolution.failure_reason
        self.city = resolution.city or self.city
        self.resolved_location = resolution.to_dict()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
