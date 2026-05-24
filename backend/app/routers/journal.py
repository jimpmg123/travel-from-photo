from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.journal import (
    JOURNAL_STATUS_DONE,
    JOURNAL_STATUS_PARTIAL_SUCCESS,
)
from app.models.user import User
from app.repositories.journal_repository import (
    count_journal_entries,
    create_pending_journal,
    delete_journal,
    find_active_job_for_user,
    get_journal_by_id,
    get_journal_entries,
    get_user_owned_images,
    list_user_journals,
    update_journal_text,
)
from app.schemas.journal import (
    GenerateJournalRequest,
    JournalDetailResponse,
    JournalEditRequest,
    JournalEntryResponse,
    JournalJobAccepted,
    JournalJobStatus,
    JournalSkippedImage,
    JournalSummary,
)
from app.services.journal.journal_jobs import process_journal_job

router = APIRouter()


def _require_owned_journal(db: Session, user: User, journal_id: int):
    journal = get_journal_by_id(db, journal_id)
    if journal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal not found.")
    if journal.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this journal.",
        )
    return journal


# ---------- Generate / poll ----------

@router.post(
    "/journals/generate",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=JournalJobAccepted,
)
def generate_journal(
    request: GenerateJournalRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active_job = find_active_job_for_user(db, current_user.id)
    if active_job is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A Journal job ({active_job.id}) is already {active_job.status} "
                "for this user. Wait for it to finish before starting another."
            ),
        )

    unique_image_ids = list(dict.fromkeys(request.image_ids))
    owned = get_user_owned_images(db, current_user.id, unique_image_ids)
    if len(owned) != len(unique_image_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="One or more image_ids do not belong to the current user.",
        )

    journal = create_pending_journal(db, current_user.id, request.title)
    background_tasks.add_task(process_journal_job, journal.id, unique_image_ids)

    return JournalJobAccepted(job_id=journal.id, status=journal.status)


@router.get("/journals/jobs/{job_id}", response_model=JournalJobStatus)
def get_journal_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    journal = _require_owned_journal(db, current_user, job_id)

    is_terminal_with_entries = journal.status in {
        JOURNAL_STATUS_DONE, JOURNAL_STATUS_PARTIAL_SUCCESS,
    }
    skipped_payload = (
        [JournalSkippedImage(image_id=item["image_id"], reason=item["reason"]) for item in journal.skipped]
        if journal.skipped else None
    )
    entries_created = (
        count_journal_entries(db, journal.id) if is_terminal_with_entries else None
    )

    return JournalJobStatus(
        job_id=journal.id,
        status=journal.status,
        journal_id=journal.id if is_terminal_with_entries else None,
        entries_created=entries_created,
        skipped=skipped_payload,
        error=journal.error_reason,
    )


# ---------- Collections (list) ----------

@router.get("/journals", response_model=list[JournalSummary])
def list_journals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = list_user_journals(db, current_user.id)
    return [
        JournalSummary(
            id=journal.id,
            title=journal.title,
            status=journal.status,
            primary_city=city,
            primary_country=country,
            entry_count=entry_count,
            earliest_captured_at=earliest,
            created_at=journal.created_at,
        )
        for journal, entry_count, earliest, city, country in rows
    ]


# ---------- Detail / edit / delete ----------

@router.get("/journals/{journal_id}", response_model=JournalDetailResponse)
def get_journal_detail(
    journal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    journal = _require_owned_journal(db, current_user, journal_id)
    entries = [
        JournalEntryResponse.model_validate(entry, from_attributes=True)
        for entry in get_journal_entries(db, journal.id)
    ]
    skipped_payload = (
        [JournalSkippedImage(image_id=item["image_id"], reason=item["reason"]) for item in journal.skipped]
        if journal.skipped else None
    )
    return JournalDetailResponse(
        id=journal.id,
        title=journal.title,
        summary=journal.summary,
        status=journal.status,
        visibility=journal.visibility,
        error_reason=journal.error_reason,
        skipped=skipped_payload,
        created_at=journal.created_at,
        updated_at=journal.updated_at,
        entries=entries,
    )


@router.patch("/journals/{journal_id}", response_model=JournalDetailResponse)
def edit_journal(
    journal_id: int,
    request: JournalEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    journal = _require_owned_journal(db, current_user, journal_id)
    entry_text_by_id = {edit.id: edit.journal_text for edit in (request.entries or [])}
    update_journal_text(db, journal, title=request.title, entry_text_by_id=entry_text_by_id)
    # Re-use the GET handler's serialization so /detail and /patch stay in sync.
    return get_journal_detail(journal_id, current_user=current_user, db=db)


@router.delete("/journals/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_journal(
    journal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    journal = _require_owned_journal(db, current_user, journal_id)
    delete_journal(db, journal)
    return None
