from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.social import UserSetting
from app.models.user import User
from app.services.auth_context import get_current_user

router = APIRouter(tags=["profile", "settings"])


class ProfileResponse(BaseModel):
    firstName: str
    lastName: str
    userId: str
    email: EmailStr
    bio: str | None = None
    displayName: str
    defaultPrivacy: str
    theme: str


class ProfileUpdateRequest(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    bio: str | None = Field(default=None, max_length=500)


class SettingsResponse(BaseModel):
    displayName: str
    defaultPrivacy: str
    theme: str
    emailNotifications: bool


class SettingsUpdateRequest(BaseModel):
    displayName: str = Field(..., min_length=1, max_length=120)
    defaultPrivacy: str = Field(default="private", pattern="^(private|unlisted|public)$")
    theme: str = Field(default="system", pattern="^(system|light|dark)$")
    emailNotifications: bool = True


def _default_display_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.user_id


def get_or_create_settings(db: Session, user: User) -> UserSetting:
    settings = db.query(UserSetting).filter(UserSetting.user_id == user.id).one_or_none()
    if settings is not None:
        return settings

    settings = UserSetting(
        user_id=user.id,
        display_name=_default_display_name(user),
        default_privacy="private",
        theme="system",
        email_notifications=True,
        bio=None,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def build_profile_response(user: User, settings: UserSetting) -> dict:
    return {
        "firstName": user.first_name,
        "lastName": user.last_name,
        "userId": user.user_id,
        "email": user.email,
        "bio": settings.bio,
        "displayName": settings.display_name,
        "defaultPrivacy": settings.default_privacy,
        "theme": settings.theme,
    }


@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(db, current_user)
    return build_profile_response(current_user, settings)


@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(db, current_user)
    current_user.first_name = payload.firstName.strip()
    current_user.last_name = payload.lastName.strip()
    current_user.email = str(payload.email).strip().lower()
    settings.bio = payload.bio.strip() if payload.bio else None
    settings.display_name = _default_display_name(current_user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already used by another account.") from exc

    db.refresh(current_user)
    db.refresh(settings)
    return build_profile_response(current_user, settings)


@router.get("/users/me", response_model=ProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(db, current_user)
    return build_profile_response(current_user, settings)


@router.get("/settings", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(db, current_user)
    return {
        "displayName": settings.display_name,
        "defaultPrivacy": settings.default_privacy,
        "theme": settings.theme,
        "emailNotifications": settings.email_notifications,
    }


@router.patch("/settings", response_model=SettingsResponse)
def update_settings(
    payload: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    display_name = payload.displayName.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Display name cannot be empty.")

    settings = get_or_create_settings(db, current_user)
    settings.display_name = display_name
    settings.default_privacy = payload.defaultPrivacy
    settings.theme = payload.theme
    settings.email_notifications = payload.emailNotifications
    db.commit()
    db.refresh(settings)

    return {
        "displayName": settings.display_name,
        "defaultPrivacy": settings.default_privacy,
        "theme": settings.theme,
        "emailNotifications": settings.email_notifications,
    }
