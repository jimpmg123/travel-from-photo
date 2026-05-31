from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.social import ChatMessage, ChatRoom, ModerationItem, UserSetting
from app.models.user import User
from app.services.chat_tags import LOUNGE_TAGS


DEFAULT_PASSWORD = "Travel2026!"


def get_or_create_user(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    user_id: str,
    email: str,
    role: str,
) -> User:
    user = db.query(User).filter(User.user_id == user_id).one_or_none()
    if user is None:
        user = User(
            first_name=first_name,
            last_name=last_name,
            user_id=user_id,
            email=email,
            password_hash=hash_password(DEFAULT_PASSWORD),
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.role = role
        user.is_active = True
        if not user.password_hash:
            user.password_hash = hash_password(DEFAULT_PASSWORD)
    return user


def get_or_create_settings(db: Session, user: User, bio: str) -> None:
    settings = db.query(UserSetting).filter(UserSetting.user_id == user.id).one_or_none()
    if settings is None:
        db.add(
            UserSetting(
                user_id=user.id,
                display_name=f"{user.first_name} {user.last_name}",
                default_privacy="private",
                theme="system",
                email_notifications=True,
                bio=bio,
            )
        )


def seed_chat_rooms(db: Session) -> dict[str, ChatRoom]:
    rooms: dict[str, ChatRoom] = {room.tag_key: room for room in db.query(ChatRoom).all()}
    for tag in LOUNGE_TAGS:
        room = rooms.get(tag.tag_key)
        if room is None:
            room = ChatRoom(
                tag_key=tag.tag_key,
                display_name=tag.display_name,
                emoji=tag.emoji,
                description=tag.description,
                category=tag.category,
            )
            db.add(room)
            db.flush()
            rooms[tag.tag_key] = room
        else:
            room.display_name = tag.display_name
            room.emoji = tag.emoji
            room.description = tag.description
            room.category = tag.category
    return rooms


def seed_chat(db: Session, sender: User, room: ChatRoom, text: str) -> None:
    exists = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room.id, ChatMessage.message_text == text)
        .one_or_none()
    )
    if exists is None:
        db.add(ChatMessage(sender_user_id=sender.id, room_id=room.id, message_text=text))


def seed_moderation(db: Session, *, item_type: str, title: str, reporter_name: str, reason: str) -> None:
    exists = db.query(ModerationItem).filter(ModerationItem.title == title).one_or_none()
    if exists is None:
        db.add(
            ModerationItem(
                item_type=item_type,
                title=title,
                reporter_name=reporter_name,
                reason=reason,
                status="open",
            )
        )


def main() -> None:
    db = SessionLocal()
    try:
        admin = get_or_create_user(
            db,
            first_name="Jaemin",
            last_name="Jeon",
            user_id="jaemin001",
            email="jaemin@example.com",
            role="admin",
        )
        traveler = get_or_create_user(
            db,
            first_name="Mina",
            last_name="Park",
            user_id="traveler102",
            email="mina@example.com",
            role="traveler",
        )
        db.flush()
        get_or_create_settings(db, admin, "I like saving travel photos and checking places later.")
        get_or_create_settings(db, traveler, "I use Travel From Photo to organize trip memories.")
        rooms = seed_chat_rooms(db)
        seed_chat(db, admin, rooms["urban"], "Welcome to Urban & Street. Share city clues, street photos, and location tips here.")
        seed_chat(db, traveler, rooms["historical"], "My Eiffel Tower photo was tagged historical and urban. Does this room keep past messages?")
        seed_chat(db, admin, rooms["historical"], "Yes. All lounge messages are saved in PostgreSQL, even when nobody is online.")
        seed_chat(db, traveler, rooms["food"], "Food photos should enter the Food & Cafe lounge after Search returns the food tag.")
        seed_chat(db, admin, rooms["sunset"], "Sunset & Sunrise is useful when the image has golden-hour lighting or sky clues.")
        seed_moderation(
            db,
            item_type="Search result",
            title="Wrong place candidate reported",
            reporter_name="Mina Park",
            reason="The returned city was close, but the exact landmark was incorrect.",
        )
        seed_moderation(
            db,
            item_type="Chat",
            title="Support request waiting",
            reporter_name="Mina Park",
            reason="User asked why manual location input did not save.",
        )
        db.commit()
        print("Seed complete.")
        print("Admin login: jaemin@example.com / Travel2026!")
        print("Traveler login: mina@example.com / Travel2026!")
        print("Chat lounges seeded: 13 tag-based rooms")
    finally:
        db.close()


if __name__ == "__main__":
    main()
