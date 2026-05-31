#!/usr/bin/env python3
"""Small local smoke test for a running Docker Compose deployment.

Run after `docker compose up --build` and `python -m app.scripts.seed_complete`.
This script uses only the Python standard library.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.getenv("SMOKE_BASE_URL", "http://localhost/api").rstrip("/")


def request(method: str, path: str, *, token: str | None = None, body: dict | None = None):
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as res:
        raw = res.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def main() -> int:
    try:
        health = request("GET", "/health")
        print("health:", health)
        login = request("POST", "/auth/login", body={"email": "jaemin@example.com", "password": "Travel2026!"})
        token = login["access_token"]
        me = request("GET", "/auth/me", token=token)
        print("me:", me["email"], me["role"])
        rooms = request("GET", "/chat-rooms", token=token)
        print("chat rooms:", len(rooms["items"]))
        admin = request("GET", "/admin/summary", token=token)
        print("admin summary:", admin)
        assert len(rooms["items"]) == 13, "Expected 13 chat lounges"
        assert me["role"] == "admin", "Seed admin account is not admin"
        print("Smoke check passed.")
        return 0
    except urllib.error.HTTPError as exc:
        print("HTTP error:", exc.code, exc.read().decode("utf-8"), file=sys.stderr)
    except Exception as exc:
        print("Smoke check failed:", exc, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
