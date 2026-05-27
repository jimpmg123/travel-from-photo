from __future__ import annotations

from app.core.db import SessionLocal, create_tables
from app.models.social import ChatMessage, ModerationItem, UserSetting
from app.models.user import User


def upsert_user(db, *, first_name: str, last_name: str, user_id: str, email: str, role: str) -> User:
    user = db.query(User).filter(User.user_id == user_id).one_or_none()
    if user is None:
        user = User(
            first_name=first_name,
            last_name=last_name,
            user_id=user_id,
            email=email,
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
    return user


def ensure_settings(db, user: User) -> None:
    settings = db.query(UserSetting).filter(UserSetting.user_id == user.id).one_or_none()
    if settings is None:
        db.add(
            UserSetting(
                user_id=user.id,
                display_name=f"{user.first_name} {user.last_name}".strip(),
                default_privacy="private",
                theme="system",
                email_notifications=True,
                bio="I like saving travel photos and checking places later.",
            )
        )


def seed() -> None:
    create_tables()
    db = SessionLocal()
    try:
        admin = upsert_user(
            db,
            first_name="Jaemin",
            last_name="Jeon",
            user_id="jaemin001",
            email="jaemin@example.com",
            role="admin",
        )
        traveler = upsert_user(
            db,
            first_name="Mina",
            last_name="Park",
            user_id="traveler102",
            email="mina@example.com",
            role="traveler",
        )
        ensure_settings(db, admin)
        ensure_settings(db, traveler)
        db.commit()

        if db.query(ChatMessage).count() == 0:
            db.add_all(
                [
                    ChatMessage(
                        sender_user_id=admin.id,
                        room_id="support",
                        message_text="Welcome. Use this chat for account, gallery, journal, or search support.",
                    ),
                    ChatMessage(
                        sender_user_id=traveler.id,
                        room_id="support",
                        message_text="I need help saving a manually entered location.",
                    ),
                ]
            )

        if db.query(ModerationItem).count() == 0:
            db.add_all(
                [
                    ModerationItem(
                        item_type="Search result",
                        title="Wrong place candidate reported",
                        reporter_name="Mina Park",
                        reason="The returned city was close, but the exact landmark was incorrect.",
                    ),
                    ModerationItem(
                        item_type="Chat",
                        title="Support request waiting",
                        reporter_name="Mina Park",
                        reason="User asked why manual location input did not save.",
                    ),
                ]
            )
        db.commit()
        print("B-track deployment seed data is ready.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
