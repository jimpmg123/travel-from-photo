# Travel From Photo Complete Deployment Guide

This version merges the A track and B track into one deployment-ready project.

## Included

A track:
- Auth, register, login, JWT token flow
- Search, gallery, journal, geocode, image metadata, saved places
- Alembic migrations already used by the backend

B track:
- Profile API and editable profile UI
- Settings API and settings UI
- Live Chat API and chat UI
- Admin API and admin panel UI
- Social database tables through Alembic migration
- Docker frontend, backend, and PostgreSQL deployment setup

## Run locally with Docker

```bash
cp .env.example .env
# Fill OPENAI_API_KEY and other API keys if you will test AI/search features.
docker compose up --build
```

Open:
- Frontend: http://localhost
- Backend docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Seed local users

For local testing only, either set this in `.env` before the first run:

```env
SEED_DB_ON_START=true
```

or run manually after containers are up:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

Sample accounts:
- Admin: jaemin@example.com / Travel2026!
- Traveler: mina@example.com / Travel2026!

## Database migration

The backend runs:

```bash
alembic upgrade head
```

inside `backend/start.sh` before starting FastAPI.

The new B track migration is:

```text
backend/alembic/versions/e7b1c2d3a4f5_add_social_b_track.py
```

It creates:
- user_settings
- chat_messages
- moderation_items

## Final deployment checklist

Before submitting or deploying:

1. Copy `.env.example` to `.env`.
2. Set a strong `JWT_SECRET`.
3. Set `OPENAI_API_KEY`.
4. Set Google API keys if search/geocode needs them.
5. Set `EMAIL_FROM` and `EMAIL_PASSWORD` if registration OTP is required.
6. Run `docker compose up --build`.
7. Open `/docs` and confirm A and B APIs appear.
8. Login and test Search, Gallery, Journal, Profile, Settings, Chat, and Admin.

## Git merge note

This complete version uses the A track as the base and adds B track files on top. It avoids the old B mock header auth and uses A's JWT auth through `app.core.deps.get_current_user` and `require_admin`.
