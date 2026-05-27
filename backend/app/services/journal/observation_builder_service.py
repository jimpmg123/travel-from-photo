from __future__ import annotations

from datetime import timedelta

from app.services.journal.contracts import JournalImageInput, JournalObservation
from app.services.journal.geo_utils import haversine_distance_meters

DEFAULT_BURST_WINDOW_SECONDS = 10
DEFAULT_BURST_DISTANCE_METERS = 30.0


# 단순 평균 계산용 내부 헬퍼다.
def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


# 현재 observation 묶음의 중심 좌표를 계산한다.
def _observation_center(images: list[JournalImageInput]) -> tuple[float, float]:
    latitudes = [image.latitude for image in images if image.latitude is not None]
    longitudes = [image.longitude for image in images if image.longitude is not None]
    return _mean(latitudes), _mean(longitudes)


# 한 장이면 single, 여러 장이면 burst observation으로 본다.
def _observation_kind(image_count: int) -> str:
    return "burst" if image_count > 1 else "single"


# 새 이미지가 현재 observation에 합쳐질 수 있는지 판단한다.
# pairwise 체인이 아니라 첫 이미지 기준 10초 규칙을 쓴다.
def _can_join_observation(
    observation_images: list[JournalImageInput],
    candidate: JournalImageInput,
    *,
    burst_window_seconds: int,
    burst_distance_meters: float,
) -> bool:
    first_image = observation_images[0]
    if candidate.captured_at is None or first_image.captured_at is None:
        return False

    if candidate.captured_at - first_image.captured_at > timedelta(seconds=burst_window_seconds):
        return False

    center_latitude, center_longitude = _observation_center(observation_images)
    return (
        haversine_distance_meters(
            center_latitude,
            center_longitude,
            candidate.latitude,
            candidate.longitude,
        )
        <= burst_distance_meters
    )


# eligible 이미지들을 시간순으로 observation 단위로 묶는다.
def build_observations(
    images: list[JournalImageInput],
    *,
    burst_window_seconds: int = DEFAULT_BURST_WINDOW_SECONDS,
    burst_distance_meters: float = DEFAULT_BURST_DISTANCE_METERS,
) -> list[JournalObservation]:
    if not images:
        return []

    ordered_images = sorted(images, key=lambda item: item.captured_at)
    observation_groups: list[list[JournalImageInput]] = []

    for image in ordered_images:
        if not observation_groups:
            observation_groups.append([image])
            continue

        current_group = observation_groups[-1]
        if _can_join_observation(
            current_group,
            image,
            burst_window_seconds=burst_window_seconds,
            burst_distance_meters=burst_distance_meters,
        ):
            current_group.append(image)
        else:
            observation_groups.append([image])

    observations: list[JournalObservation] = []
    for order, group in enumerate(observation_groups, start=1):
        center_latitude, center_longitude = _observation_center(group)
        representative = group[0]

        observations.append(
            JournalObservation(
                observation_id=f"obs-{order}",
                observation_order=order,
                image_ids=[image.image_id for image in group],
                representative_image_id=representative.image_id,
                representative_image_path=representative.absolute_path,
                observation_kind=_observation_kind(len(group)),
                start_time=group[0].captured_at,
                end_time=group[-1].captured_at,
                center_latitude=round(center_latitude, 6),
                center_longitude=round(center_longitude, 6),
                image_count=len(group),
                country_snapshot=representative.country,
                city_snapshot=representative.city,
            )
        )

    return observations
