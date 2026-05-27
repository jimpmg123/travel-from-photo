from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.social import ChatMessage as ChatMessageModel
from app.models.user import User
from app.services.auth_context import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    id: str
    senderId: str
    senderName: str
    messageText: str
    createdAt: datetime
    readAt: datetime | None = None


class ChatMessageCreate(BaseModel):
    messageText: str = Field(..., min_length=1, max_length=1000)
    roomId: str = Field(default="support", min_length=1, max_length=80)


class ChatMessageList(BaseModel):
    items: list[ChatMessage]


def _sender_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.user_id


def _serialize_message(message: ChatMessageModel) -> dict:
    return {
        "id": str(message.id),
        "senderId": message.sender.user_id,
        "senderName": _sender_name(message.sender),
        "messageText": message.message_text,
        "createdAt": message.created_at,
        "readAt": message.read_at,
    }


@router.get("/messages", response_model=ChatMessageList)
def list_messages(
    roomId: str = Query(default="support", min_length=1, max_length=80),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    messages = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.room_id == roomId)
        .order_by(ChatMessageModel.created_at.asc(), ChatMessageModel.id.asc())
        .limit(limit)
        .all()
    )
    return {"items": [_serialize_message(message) for message in messages]}


@router.post("/messages", response_model=ChatMessage)
def send_message(
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = payload.messageText.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    message = ChatMessageModel(
        sender_user_id=current_user.id,
        room_id=payload.roomId.strip(),
        message_text=text,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _serialize_message(message)


@router.patch("/messages/{message_id}/read", response_model=ChatMessage)
def mark_message_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    message = db.get(ChatMessageModel, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found.")

    message.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)
    return _serialize_message(message)
