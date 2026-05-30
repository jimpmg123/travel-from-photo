from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.social import ChatMessage, ModerationItem, UserSetting
from app.models.user import User


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


def seed_chat(db: Session, sender: User, text: str) -> None:
    exists = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == "support", ChatMessage.message_text == text)
        .one_or_none()
    )
    if exists is None:
        db.add(ChatMessage(sender_user_id=sender.id, room_id="support", message_text=text))


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
        seed_chat(db, admin, "Welcome. Use this chat for account, gallery, journal, or search support.")
        seed_chat(db, traveler, "I need help saving a manually entered location.")
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
    finally:
        db.close()


if __name__ == "__main__":
    main()
