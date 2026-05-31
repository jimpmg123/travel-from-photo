from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.image_metadata import ImageMetadata
from app.models.journal import (
    JOURNAL_ACTIVE_STATUSES,
    JOURNAL_STATUS_PENDING,
    Journal,
    JournalEntry,
)
from app.models.saved_place import SavedPlace


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


def list_user_journals(db: Session, user_id: int) -> list[tuple[Journal, int, datetime | None, str | None, str | None, str | None]]:
    """Return rows of (journal, entry_count, earliest_captured_at, primary_city,
    primary_country) for the collections page. We bundle the aggregates into
    one query so the collections grid stays cheap as the list grows."""
    entry_count_subq = (
        select(
            JournalEntry.journal_id.label("jid"),
            func.count().label("entry_count"),
            func.min(JournalEntry.captured_at).label("earliest"),
        )
        .group_by(JournalEntry.journal_id)
        .subquery()
    )

    # First entry subquery: city/country + image_id for cover photo
    first_entry_subq = (
        select(
            JournalEntry.journal_id.label("jid"),
            JournalEntry.city.label("city"),
            JournalEntry.country.label("country"),
            JournalEntry.image_id.label("image_id"),
            JournalEntry.entry_order.label("entry_order"),
        )
        .subquery()
    )

    # Cover image: look up saved_place.image_url via image_metadata_id
    cover_subq = (
        select(
            SavedPlace.image_metadata_id.label("img_id"),
            SavedPlace.image_url.label("cover_url"),
        )
        .where(SavedPlace.user_id == user_id)
        .where(SavedPlace.image_url.isnot(None))
        .subquery()
    )

    stmt = (
        select(
            Journal,
            entry_count_subq.c.entry_count,
            entry_count_subq.c.earliest,
            first_entry_subq.c.city,
            first_entry_subq.c.country,
            cover_subq.c.cover_url,
        )
        .outerjoin(entry_count_subq, entry_count_subq.c.jid == Journal.id)
        .outerjoin(
            first_entry_subq,
            (first_entry_subq.c.jid == Journal.id) & (first_entry_subq.c.entry_order == 0),
        )
        .outerjoin(cover_subq, cover_subq.c.img_id == first_entry_subq.c.image_id)
        .where(Journal.user_id == user_id)
        .order_by(Journal.created_at.desc())
    )

    rows: list[tuple[Journal, int, datetime | None, str | None, str | None, str | None]] = []
    for journal, entry_count, earliest, city, country, cover_url in db.execute(stmt).all():
        rows.append((journal, int(entry_count or 0), earliest, city, country, cover_url))
    return rows


def get_journal_entries(db: Session, journal_id: int) -> list[JournalEntry]:
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.journal_id == journal_id)
        .order_by(JournalEntry.entry_order.asc())
    )
    return list(db.execute(stmt).scalars().all())


def update_journal_text(
    db: Session,
    journal: Journal,
    *,
    title: str | None,
    entry_text_by_id: dict[int, str | None],
) -> Journal:
    if title is not None:
        journal.title = title
    if entry_text_by_id:
        # One-shot UPDATE per entry; tiny n in practice (<=20), no batching needed.
        for entry in get_journal_entries(db, journal.id):
            if entry.id in entry_text_by_id:
                entry.journal_text = entry_text_by_id[entry.id]
    db.commit()
    db.refresh(journal)
    return journal


def delete_journal(db: Session, journal: Journal) -> None:
    db.delete(journal)
    db.commit()
