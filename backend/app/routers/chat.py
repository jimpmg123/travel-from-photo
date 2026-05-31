from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.repository import get_user_by_id
from app.core.db import SessionLocal, get_db
from app.core.deps import get_current_user
from app.core.security import decode_access_token
from app.models.image_metadata import ImageMetadata
from app.models.saved_place import SavedPlace
from app.models.social import ChatMessage as ChatMessageModel
from app.models.social import ChatRoom as ChatRoomModel
from app.models.user import User
from app.services.chat_tags import LOUNGE_TAGS, TAG_BY_KEY, lounge_payload_for_tags, normalize_lounge_tags

router = APIRouter(tags=["chat"])


class ChatRoom(BaseModel):
    id: int
    tagKey: str
    displayName: str
    emoji: str
    description: str
    category: str
    onlineCount: int = 0
    messageCount: int = 0


class ChatRoomList(BaseModel):
    items: list[ChatRoom]


class ChatMessage(BaseModel):
    id: str
    roomId: int
    roomTag: str
    senderId: str
    senderName: str
    messageText: str
    imageId: int | None = None
    imageUrl: str | None = None
    createdAt: datetime
    readAt: datetime | None = None


class ChatMessageCreate(BaseModel):
    messageText: str = Field(..., min_length=1, max_length=1000)
    imageId: int | None = None
    imageUrl: str | None = Field(default=None, max_length=500)


class ChatMessageList(BaseModel):
    items: list[ChatMessage]


class TagNormalizeRequest(BaseModel):
    analysis: dict[str, Any] = Field(default_factory=dict)


class TagNormalizeResponse(BaseModel):
    tags: list[str]
    lounges: list[dict[str, str]]


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = {}

    async def connect(self, room_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)

    def disconnect(self, room_id: int, websocket: WebSocket) -> None:
        sockets = self._rooms.get(room_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._rooms.pop(room_id, None)

    def online_count(self, room_id: int) -> int:
        return len(self._rooms.get(room_id, set()))

    async def broadcast(self, room_id: int, payload: dict[str, Any]) -> None:
        sockets = list(self._rooms.get(room_id, set()))
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except RuntimeError:
                self.disconnect(room_id, socket)


manager = ConnectionManager()


def _sender_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.user_id


def _serialize_room(room: ChatRoomModel, db: Session) -> dict[str, Any]:
    return {
        "id": room.id,
        "tagKey": room.tag_key,
        "displayName": room.display_name,
        "emoji": room.emoji,
        "description": room.description,
        "category": room.category,
        "onlineCount": manager.online_count(room.id),
        "messageCount": db.query(ChatMessageModel).filter(ChatMessageModel.room_id == room.id).count(),
    }


def _serialize_message(message: ChatMessageModel) -> dict[str, Any]:
    return {
        "id": str(message.id),
        "roomId": int(message.room_id),
        "roomTag": message.room.tag_key if message.room else "unknown",
        "senderId": message.sender.user_id,
        "senderName": _sender_name(message.sender),
        "messageText": message.message_text,
        "imageId": message.image_id,
        "imageUrl": message.image_url,
        "createdAt": message.created_at,
        "readAt": message.read_at,
    }


def ensure_chat_rooms(db: Session) -> None:
    existing = {room.tag_key: room for room in db.query(ChatRoomModel).all()}
    changed = False
    for tag in LOUNGE_TAGS:
        room = existing.get(tag.tag_key)
        if room is None:
            db.add(
                ChatRoomModel(
                    tag_key=tag.tag_key,
                    display_name=tag.display_name,
                    emoji=tag.emoji,
                    description=tag.description,
                    category=tag.category,
                )
            )
            changed = True
        else:
            room.display_name = tag.display_name
            room.emoji = tag.emoji
            room.description = tag.description
            room.category = tag.category
    if changed:
        db.commit()


def _get_room_or_404(db: Session, room_id: int) -> ChatRoomModel:
    ensure_chat_rooms(db)
    room = db.get(ChatRoomModel, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Chat room not found.")
    return room


def _get_room_by_key_or_default(db: Session, tag_key: str | None) -> ChatRoomModel:
    ensure_chat_rooms(db)
    key = (tag_key or "urban").strip().lower()
    if key == "support":
        key = "urban"
    room = db.query(ChatRoomModel).filter(ChatRoomModel.tag_key == key).one_or_none()
    if room is None:
        room = db.query(ChatRoomModel).filter(ChatRoomModel.tag_key == "urban").one()
    return room


def _image_belongs_to_user(db: Session, image_id: int | None, current_user: User) -> None:
    if image_id is None:
        return
    image = db.get(ImageMetadata, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Attached image not found.")
    if image.user_id is not None and image.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot attach this image.")


def _gallery_image_belongs_to_user(db: Session, image_url: str | None, current_user: User) -> None:
    """A chat attachment URL must come from one of the sender's own saved places."""
    if not image_url:
        return
    owned = (
        db.query(SavedPlace.id)
        .filter(SavedPlace.user_id == current_user.id, SavedPlace.image_url == image_url)
        .first()
    )
    if owned is None:
        raise HTTPException(status_code=403, detail="You can only attach photos from your own gallery.")


async def _authenticate_ws_user(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = get_user_by_id(db, int(user_id))
        if not user or not user.is_active:
            return None
        return user
    except Exception:
        return None


@router.get("/chat-rooms", response_model=ChatRoomList)
def list_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    ensure_chat_rooms(db)
    rooms = db.query(ChatRoomModel).order_by(ChatRoomModel.id.asc()).all()
    return {"items": [_serialize_room(room, db) for room in rooms]}


@router.get("/chat-rooms/recommendations", response_model=ChatRoomList)
def recommended_chat_rooms(
    tags: str = Query(default="", description="Comma-separated standard tag keys."),
    imageId: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_chat_rooms(db)
    tag_keys = [tag.strip().lower() for tag in tags.split(",") if tag.strip()]
    if imageId is not None:
        image = db.get(ImageMetadata, imageId)
        if image is None:
            raise HTTPException(status_code=404, detail="Image not found.")
        if image.user_id is not None and image.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You cannot view this image.")
        if image.tags:
            tag_keys = list(image.tags)
    if not tag_keys:
        tag_keys = ["urban"]
    rooms = db.query(ChatRoomModel).filter(ChatRoomModel.tag_key.in_(tag_keys[:3])).all()
    rooms_by_key = {room.tag_key: room for room in rooms}
    ordered = [rooms_by_key[key] for key in tag_keys[:3] if key in rooms_by_key]
    return {"items": [_serialize_room(room, db) for room in ordered]}


@router.post("/chat-tags/normalize", response_model=TagNormalizeResponse)
def normalize_chat_tags(
    payload: TagNormalizeRequest,
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    tags = normalize_lounge_tags(payload.analysis)
    return {"tags": tags, "lounges": lounge_payload_for_tags(tags)}


@router.get("/chat-rooms/{room_id}/messages", response_model=ChatMessageList)
def list_room_messages(
    room_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    room = _get_room_or_404(db, room_id)
    messages = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.room_id == room.id)
        .order_by(ChatMessageModel.created_at.desc(), ChatMessageModel.id.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()
    return {"items": [_serialize_message(message) for message in messages]}


@router.post("/chat-rooms/{room_id}/messages", response_model=ChatMessage)
def send_room_message(
    room_id: int,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = _get_room_or_404(db, room_id)
    text = payload.messageText.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    _image_belongs_to_user(db, payload.imageId, current_user)
    _gallery_image_belongs_to_user(db, payload.imageUrl, current_user)

    message = ChatMessageModel(
        room_id=room.id,
        sender_user_id=current_user.id,
        message_text=text,
        image_id=payload.imageId,
        image_url=payload.imageUrl,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _serialize_message(message)


@router.get("/chat/messages", response_model=ChatMessageList)
def list_messages_legacy(
    roomId: str = Query(default="urban", min_length=1, max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = _get_room_by_key_or_default(db, roomId)
    return list_room_messages(room.id, limit=limit, current_user=current_user, db=db)


@router.post("/chat/messages", response_model=ChatMessage)
def send_message_legacy(
    payload: ChatMessageCreate,
    roomId: str = Query(default="urban", min_length=1, max_length=80),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = _get_room_by_key_or_default(db, roomId)
    return send_room_message(room.id, payload=payload, current_user=current_user, db=db)


@router.patch("/chat/messages/{message_id}/read", response_model=ChatMessage)
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


@router.websocket("/ws/chat/{room_id}")
async def chat_websocket(websocket: WebSocket, room_id: int, token: str | None = Query(default=None)):
    db = SessionLocal()
    current_user: User | None = None
    try:
        current_user = await _authenticate_ws_user(token, db)
        if current_user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        room = db.get(ChatRoomModel, room_id)
        if room is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        await manager.connect(room_id, websocket)
        await manager.broadcast(room_id, {"type": "presence", "roomId": room_id, "onlineCount": manager.online_count(room_id)})
        while True:
            data = await websocket.receive_json()
            text = str(data.get("messageText") or data.get("content") or "").strip()
            if not text:
                continue
            image_id = data.get("imageId")
            image_id_int = int(image_id) if image_id is not None else None
            image_url = data.get("imageUrl")
            image_url_str = str(image_url)[:500] if image_url else None
            try:
                _image_belongs_to_user(db, image_id_int, current_user)
                _gallery_image_belongs_to_user(db, image_url_str, current_user)
            except HTTPException:
                await websocket.send_json({"type": "error", "detail": "Invalid image attachment."})
                continue
            message = ChatMessageModel(
                room_id=room_id,
                sender_user_id=current_user.id,
                message_text=text[:1000],
                image_id=image_id_int,
                image_url=image_url_str,
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            await manager.broadcast(room_id, {"type": "message", "message": _serialize_message(message)})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room_id, websocket)
        if current_user is not None:
            await manager.broadcast(room_id, {"type": "presence", "roomId": room_id, "onlineCount": manager.online_count(room_id)})
        db.close()
