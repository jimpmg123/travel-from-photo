from datetime import datetime

from sqlalchemy.orm import Session

from app.auth.models import OTP
from app.core.security import hash_password
from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_user_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_id(db: Session, id: int) -> User | None:
    return db.query(User).filter(User.id == id).first()


def create_user(
    db: Session,
    first_name: str,
    last_name: str,
    user_id: str,
    email: str,
    password: str,
) -> User:
    user = User(
        first_name=first_name,
        last_name=last_name,
        user_id=user_id,
        email=email,
        password_hash=hash_password(password),
        auth_provider="local",
        role="traveler",
        is_active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def activate_user(db: Session, email: str) -> None:
    user = get_user_by_email(db, email)
    if user:
        user.is_active = True
        db.commit()


def create_otp(db: Session, email: str, code: str, expires_at: datetime) -> OTP:
    db.query(OTP).filter(OTP.email == email).delete()
    db.commit()
    otp = OTP(email=email, code=code, expires_at=expires_at)
    db.add(otp)
    db.commit()
    db.refresh(otp)
    return otp


def get_latest_otp(db: Session, email: str) -> OTP | None:
    return (
        db.query(OTP)
        .filter(OTP.email == email, OTP.is_used == False)  # noqa: E712
        .order_by(OTP.created_at.desc())
        .first()
    )


def mark_otp_used(db: Session, otp: OTP) -> None:
    otp.is_used = True
    db.commit()
