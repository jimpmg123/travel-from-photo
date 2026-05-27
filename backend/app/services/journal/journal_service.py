from __future__ import annotations

from collections.abc import Callable, Iterable

from app.services.journal.clip_journal_service import enrich_observation_scene
from app.services.journal.contracts import JournalImageInput, JournalObservation, JournalTimeline
from app.services.journal.document_classifier_service import enrich_observation_document
from app.services.journal.journal_eligibility_service import filter_eligible_journal_images
from app.services.journal.observation_builder_service import build_observations
from app.services.journal.segment_builder_service import build_segments
from app.services.journal.segment_classifier_service import classify_observations

ObservationEnricher = Callable[[JournalObservation], JournalObservation]


# Journal 코어 파이프라인 전체를 한 번에 묶어 실행한다.
def build_journal_timeline(
    images: Iterable[JournalImageInput],
    *,
    observation_enrichers: Iterable[ObservationEnricher] | None = None,
    run_clip_classification: bool = False,
    run_document_classification: bool = False,
) -> JournalTimeline:
    eligible_images, rejected_images = filter_eligible_journal_images(list(images))
    observations = build_observations(eligible_images)

    enrichers: list[ObservationEnricher] = []
    if run_clip_classification:
        enrichers.append(enrich_observation_scene)
    enrichers.extend(list(observation_enrichers or []))
    if run_document_classification:
        enrichers.append(enrich_observation_document)

    for index, observation in enumerate(observations):
        enriched = observation
        for enricher in enrichers:
            enriched = enricher(enriched)
        observations[index] = enriched

    classified_observations = classify_observations(observations)
    segments = build_segments(classified_observations)

    return JournalTimeline(
        eligible_images=eligible_images,
        rejected_images=rejected_images,
        observations=classified_observations,
        segments=segments,
    )
