from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any


# Journal 파이프라인에 들어가기 전, 이미지 1장에 대해 필요한 최소 입력값을 묶는다.
@dataclass(slots=True)
class JournalImageInput:
    image_id: int
    captured_at: datetime | None
    latitude: float | None
    longitude: float | None
    has_exif_datetime: bool
    has_exif_gps: bool
    file_name: str | None = None
    absolute_path: str | None = None
    country: str | None = None
    city: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Journal 대상에서 제외된 이미지가 왜 탈락했는지 명확하게 남긴다.
@dataclass(slots=True)
class JournalImageRejection:
    image_id: int
    reason_code: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Observation은 burst 이미지를 하나의 순간 단위로 묶은 중간 결과물이다.
@dataclass(slots=True)
class JournalObservation:
    observation_id: str
    observation_order: int
    image_ids: list[int]
    representative_image_id: int
    representative_image_path: str | None
    observation_kind: str
    start_time: datetime
    end_time: datetime
    center_latitude: float
    center_longitude: float
    image_count: int
    country_snapshot: str | None = None
    city_snapshot: str | None = None
    formatted_address: str | None = None
    english_location_hint: str | None = None
    poi_place_id: str | None = None
    poi_name: str | None = None
    poi_primary_type: str | None = None
    poi_distance_meters: float | None = None
    nearest_poi_name: str | None = None
    nearest_poi_primary_type: str | None = None
    nearest_poi_formatted_address: str | None = None
    scene_label: str | None = None
    scene_confidence: float | None = None
    ocr_text: str | None = None
    ocr_locale: str | None = None
    document_type: str = "none"
    document_confidence: float | None = None
    suggested_segment_type: str | None = None
    stay_score: float = 0.0
    transit_score: float = 0.0
    classification_reason: str | None = None

    # Observation 길이를 초 단위로 계산한다.
    def duration_seconds(self) -> float:
        return max((self.end_time - self.start_time).total_seconds(), 0.0)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Segment는 최종 저널 타임라인에서 실제로 보여줄 stay / transit 구간이다.
@dataclass(slots=True)
class JournalSegment:
    segment_id: str
    segment_order: int
    segment_type: str
    is_inferred: bool
    observation_ids: list[str]
    image_ids: list[int]
    poi_place_id: str | None
    location_name: str | None
    country: str | None
    city: str | None
    start_time: datetime
    end_time: datetime
    duration_minutes: int | None
    formatted_address: str | None = None
    english_location_hint: str | None = None
    travel_mode: str | None = None
    travel_distance_km: float | None = None
    generated_text: str | None = None
    edited_text: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# 한 번의 Journal 생성 요청에서 나온 전체 결과를 한 객체로 묶는다.
@dataclass(slots=True)
class JournalTimeline:
    eligible_images: list[JournalImageInput]
    rejected_images: list[JournalImageRejection]
    observations: list[JournalObservation]
    segments: list[JournalSegment]

    def to_dict(self) -> dict[str, Any]:
        return {
            "eligible_images": [image.to_dict() for image in self.eligible_images],
            "rejected_images": [rejection.to_dict() for rejection in self.rejected_images],
            "observations": [observation.to_dict() for observation in self.observations],
            "segments": [segment.to_dict() for segment in self.segments],
        }
