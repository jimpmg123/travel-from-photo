from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.social import ModerationItem as ModerationItemModel
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


class BugReportCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=2000)


class BugReportOut(BaseModel):
    id: str
    status: str
    createdAt: datetime


def _reporter_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.user_id


@router.post("", response_model=BugReportOut, status_code=201)
def submit_bug_report(
    payload: BugReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any authenticated user can send a bug report; it lands in the admin moderation queue."""
    item = ModerationItemModel(
        item_type="bug",
        title=payload.title.strip()[:200],
        reporter_name=_reporter_name(current_user),
        reason=payload.description.strip()[:2000],
        status="open",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": str(item.id), "status": item.status, "createdAt": item.created_at}
