from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.social import ChatMessage as ChatMessageModel
from app.models.social import ModerationItem as ModerationItemModel
from app.models.user import User
from app.core.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

Role = Literal["traveler", "admin"]
Status = Literal["active", "disabled", "review"]


class AdminUser(BaseModel):
    id: str
    displayName: str
    email: EmailStr
    role: Role
    status: Status
    uploads: int
    journals: int
    lastActive: str


class AdminUserList(BaseModel):
    items: list[AdminUser]


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    status: Status | None = None


class ModerationItemCreate(BaseModel):
    type: str
    title: str
    reporter: str
    reason: str


class ModerationItem(BaseModel):
    id: str
    type: str
    title: str
    reporter: str
    reason: str
    status: Literal["open", "resolved"]
    createdAt: datetime


class ModerationList(BaseModel):
    items: list[ModerationItem]


class AdminSummary(BaseModel):
    totalUsers: int
    activeUsers: int
    reviewUsers: int
    disabledUsers: int
    openModerationItems: int
    totalChatMessages: int


def _display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.user_id


def _status(user: User) -> Status:
    if not user.is_active:
        return "disabled"
    return "review" if user.role == "review" else "active"


def _serialize_user(user: User) -> dict:
    return {
        "id": user.user_id,
        "displayName": _display_name(user),
        "email": user.email,
        "role": "admin" if user.role == "admin" else "traveler",
        "status": _status(user),
        "uploads": 0,
        "journals": 0,
        "lastActive": user.updated_at.isoformat() if user.updated_at else "Unknown",
    }


def _serialize_moderation(item: ModerationItemModel) -> dict:
    return {
        "id": str(item.id),
        "type": item.item_type,
        "title": item.title,
        "reporter": item.reporter_name,
        "reason": item.reason,
        "status": item.status,
        "createdAt": item.created_at,
    }


@router.get("/summary", response_model=AdminSummary)
def get_admin_summary(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    disabled_users = db.query(func.count(User.id)).filter(User.is_active.is_(False)).scalar() or 0
    open_moderation = (
        db.query(func.count(ModerationItemModel.id))
        .filter(ModerationItemModel.status == "open")
        .scalar()
        or 0
    )
    total_chat = db.query(func.count(ChatMessageModel.id)).scalar() or 0
    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "reviewUsers": 0,
        "disabledUsers": disabled_users,
        "openModerationItems": open_moderation,
        "totalChatMessages": total_chat,
    }


@router.get("/users", response_model=AdminUserList)
def list_users(
    q: str = Query(default="", max_length=80),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    query = db.query(User).order_by(User.updated_at.desc(), User.id.desc())
    normalized_query = q.strip().lower()
    if normalized_query:
        like = f"%{normalized_query}%"
        query = query.filter(
            or_(
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
                func.lower(User.email).like(like),
                func.lower(User.user_id).like(like),
            )
        )
    return {"items": [_serialize_user(user) for user in query.limit(100).all()]}


@router.patch("/users/{user_id}", response_model=AdminUser)
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.user_id == user_id).one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_admin.id and payload.status == "disabled":
        raise HTTPException(status_code=400, detail="You cannot disable your own admin account.")

    if payload.role is not None:
        user.role = payload.role
    if payload.status is not None:
        user.is_active = payload.status != "disabled"
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.get("/moderation", response_model=ModerationList)
def list_moderation_items(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    items = db.query(ModerationItemModel).order_by(ModerationItemModel.created_at.desc()).limit(100).all()
    return {"items": [_serialize_moderation(item) for item in items]}


@router.post("/moderation", response_model=ModerationItem)
def create_moderation_item(
    payload: ModerationItemCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    item = ModerationItemModel(
        item_type=payload.type.strip(),
        title=payload.title.strip(),
        reporter_name=payload.reporter.strip(),
        reason=payload.reason.strip(),
        status="open",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_moderation(item)


@router.patch("/moderation/{item_id}", response_model=ModerationItem)
def resolve_moderation_item(
    item_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    item = db.get(ModerationItemModel, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Moderation item not found.")
    item.status = "resolved"
    item.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _serialize_moderation(item)
