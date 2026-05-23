from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.image_metadata import ImageMetadata
from app.models.journal import (
    JOURNAL_ACTIVE_STATUSES,
    JOURNAL_STATUS_PENDING,
    Journal,
    JournalEntry,
)


def find_active_job_for_user(db: Session, user_id: int) -> Journal | None:
    """Return any pending/processing Journal owned by the user, else None."""
    stmt = (
        select(Journal)
        .where(Journal.user_id == user_id)
        .where(Journal.status.in_(JOURNAL_ACTIVE_STATUSES))
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def create_pending_journal(db: Session, user_id: int, title: str | None) -> Journal:
    journal = Journal(
        user_id=user_id,
        title=title,
        status=JOURNAL_STATUS_PENDING,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)
    return journal


def get_journal_by_id(db: Session, journal_id: int) -> Journal | None:
    return db.get(Journal, journal_id)


def get_user_owned_images(
    db: Session, user_id: int, image_ids: list[int]
) -> list[ImageMetadata]:
    """Return only the images that exist AND belong to the given user."""
    if not image_ids:
        return []
    stmt = (
        select(ImageMetadata)
        .where(ImageMetadata.id.in_(image_ids))
        .where(ImageMetadata.user_id == user_id)
    )
    return list(db.execute(stmt).scalars().all())


def get_persisted_image_ids(db: Session, journal_id: int) -> set[int]:
    """Image ids that already have a JournalEntry for this journal.

    Used for idempotency: a retry of a partial job must skip these so we don't
    double-process or trip the UNIQUE(journal_id, image_id) constraint."""
    stmt = select(JournalEntry.image_id).where(JournalEntry.journal_id == journal_id)
    return {row for row in db.execute(stmt).scalars().all()}


def count_journal_entries(db: Session, journal_id: int) -> int:
    stmt = select(func.count()).select_from(JournalEntry).where(
        JournalEntry.journal_id == journal_id,
    )
    return int(db.execute(stmt).scalar_one() or 0)
