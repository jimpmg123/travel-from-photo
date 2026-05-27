"""Small JSON-backed state store for B-track demo APIs.

This keeps the profile, settings, chat, and admin demo data persistent across
backend restarts without changing the main database/auth work owned by the A
track. When the real auth/database branch is merged, routers can replace these
helpers with SQLAlchemy repositories while keeping the same API contract.
"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

STORE_PATH = Path(__file__).resolve().parents[2] / ".runtime" / "social_state.json"
_LOCK = Lock()


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


DEFAULT_STATE: dict[str, Any] = {
    "profile": {
        "firstName": "Jae min",
        "lastName": "Jeon",
        "userId": "jaemin001",
        "email": "jaemin@example.com",
        "bio": "I like saving travel photos and checking places later.",
        "displayName": "Jaemin Jeon",
        "defaultPrivacy": "private",
        "theme": "system",
        "emailNotifications": True,
    },
    "chatMessages": [
        {
            "id": "msg_001",
            "senderId": "system",
            "senderName": "Travel From Photo Support",
            "messageText": "Welcome. Use this chat to ask for help with photo search, gallery, or journal issues.",
            "createdAt": _now_iso(),
            "readAt": None,
        },
        {
            "id": "msg_002",
            "senderId": "admin001",
            "senderName": "Admin",
            "messageText": "Admin messages and support replies are stored here for authenticated users.",
            "createdAt": _now_iso(),
            "readAt": None,
        },
    ],
    "adminUsers": [
        {
            "id": "jaemin001",
            "displayName": "Jaemin Jeon",
            "email": "jaemin@example.com",
            "role": "admin",
            "status": "active",
            "uploads": 12,
            "journals": 3,
            "lastActive": "Today",
        },
        {
            "id": "traveler102",
            "displayName": "Mina Park",
            "email": "mina@example.com",
            "role": "traveler",
            "status": "review",
            "uploads": 7,
            "journals": 1,
            "lastActive": "Yesterday",
        },
        {
            "id": "traveler203",
            "displayName": "Daniel Kim",
            "email": "daniel@example.com",
            "role": "traveler",
            "status": "active",
            "uploads": 4,
            "journals": 0,
            "lastActive": "3 days ago",
        },
    ],
    "moderation": [
        {
            "id": "mod_001",
            "type": "Search result",
            "title": "Wrong place candidate reported",
            "reporter": "Mina Park",
            "reason": "The returned city was close, but the exact landmark was incorrect.",
            "status": "open",
            "createdAt": _now_iso(),
        },
        {
            "id": "mod_002",
            "type": "Chat",
            "title": "Support request waiting",
            "reporter": "Daniel Kim",
            "reason": "User asked why manual location input did not save.",
            "status": "open",
            "createdAt": _now_iso(),
        },
    ],
}


def _merge_defaults(state: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(DEFAULT_STATE)
    for key, value in state.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


def load_state() -> dict[str, Any]:
    with _LOCK:
        if not STORE_PATH.exists():
            state = deepcopy(DEFAULT_STATE)
            save_state_unlocked(state)
            return deepcopy(state)

        try:
            with STORE_PATH.open("r", encoding="utf-8") as fp:
                return _merge_defaults(json.load(fp))
        except (OSError, json.JSONDecodeError):
            state = deepcopy(DEFAULT_STATE)
            save_state_unlocked(state)
            return deepcopy(state)


def save_state_unlocked(state: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with STORE_PATH.open("w", encoding="utf-8") as fp:
        json.dump(state, fp, indent=2, ensure_ascii=False)


def save_state(state: dict[str, Any]) -> None:
    with _LOCK:
        save_state_unlocked(state)


def reset_state() -> dict[str, Any]:
    state = deepcopy(DEFAULT_STATE)
    save_state(state)
    return deepcopy(state)
