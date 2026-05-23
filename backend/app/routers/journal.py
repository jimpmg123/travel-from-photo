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
    create_pending_journal,
    find_active_job_for_user,
    get_journal_by_id,
    get_user_owned_images,
)
from app.schemas.journal import (
    GenerateJournalRequest,
    JournalJobAccepted,
    JournalJobStatus,
)
from app.services.journal.journal_jobs import process_journal_job

router = APIRouter()


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
    # Concurrency rule: one active job per user at a time (Feature 1).
    active_job = find_active_job_for_user(db, current_user.id)
    if active_job is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A Journal job ({active_job.id}) is already {active_job.status} "
                "for this user. Wait for it to finish before starting another."
            ),
        )

    # Ownership: every requested image must belong to the current user.
    unique_image_ids = list(dict.fromkeys(request.image_ids))  # preserve order, drop dups
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
    journal = get_journal_by_id(db, job_id)
    if journal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if journal.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this job.",
        )

    # journal_id is only meaningful once the job has actually persisted entries.
    # Step 2 stub jumps straight to 'done' without writing entries, so we still
    # surface journal_id for the contract — Step 5 will populate entries_created
    # and skipped as well.
    journal_id_for_payload = (
        journal.id if journal.status in {JOURNAL_STATUS_DONE, JOURNAL_STATUS_PARTIAL_SUCCESS} else None
    )

    return JournalJobStatus(
        job_id=journal.id,
        status=journal.status,
        journal_id=journal_id_for_payload,
        error=journal.error_reason,
    )
