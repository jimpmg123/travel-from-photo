from __future__ import annotations

from app.services.journal.contracts import JournalImageInput, JournalImageRejection


# 이미지 1장이 Journal 파이프라인에 들어갈 수 있는지 먼저 검사한다.
def evaluate_journal_image_eligibility(image: JournalImageInput) -> JournalImageRejection | None:
    if not image.has_exif_datetime:
        return JournalImageRejection(
            image_id=image.image_id,
            reason_code="missing_exif_datetime",
            reason="Journal requires an exact EXIF capture time.",
        )

    if not image.has_exif_gps:
        return JournalImageRejection(
            image_id=image.image_id,
            reason_code="missing_exif_gps",
            reason="Journal requires exact EXIF GPS coordinates.",
        )

    if image.captured_at is None:
        return JournalImageRejection(
            image_id=image.image_id,
            reason_code="missing_captured_at",
            reason="Journal requires a parsed capture timestamp.",
        )

    if image.latitude is None or image.longitude is None:
        return JournalImageRejection(
            image_id=image.image_id,
            reason_code="missing_coordinates",
            reason="Journal requires parsed EXIF coordinates.",
        )

    return None


# 전체 입력 이미지에서 Journal 대상만 추리고, 탈락 사유도 같이 반환한다.
def filter_eligible_journal_images(
    images: list[JournalImageInput],
) -> tuple[list[JournalImageInput], list[JournalImageRejection]]:
    eligible: list[JournalImageInput] = []
    rejected: list[JournalImageRejection] = []

    for image in images:
        rejection = evaluate_journal_image_eligibility(image)
        if rejection is None:
            eligible.append(image)
        else:
            rejected.append(rejection)

    eligible.sort(key=lambda item: item.captured_at)
    return eligible, rejected
