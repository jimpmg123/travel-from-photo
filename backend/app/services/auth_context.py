from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User


def _display_parts(display_name: str | None, fallback: str) -> tuple[str, str]:
    name = (display_name or fallback).strip() or fallback
    parts = name.split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], "User"
    return parts[0], parts[1]


def get_current_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user for B-track endpoints.

    This project branch does not own the final auth system. For deployment before
    the A-track JWT/session merge, the frontend sends X-User-* headers. The
    database remains the source of truth for role and account status. After A's
    auth is merged, replace this function with token/session verification and
    keep the router contracts unchanged.
    """

    normalized_user_id = (x_user_id or "").strip()
    if not normalized_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header.")

    user = db.query(User).filter(User.user_id == normalized_user_id).one_or_none()
    if user is None:
        first_name, last_name = _display_parts(x_user_name, normalized_user_id)
        user = User(
            first_name=first_name,
            last_name=last_name,
            user_id=normalized_user_id,
            email=(x_user_email or f"{normalized_user_id}@local.travel-from-photo").strip().lower(),
            role="traveler",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled.")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role is required.")
    return current_user
