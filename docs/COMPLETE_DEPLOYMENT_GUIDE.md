# Travel From Photo Complete Deployment Guide

This document describes how to deploy the final merged release. The A track (Search / Gallery / Journal) and B track (Profile / Settings / Live Chat / Admin) are integrated into a single Docker Compose stack with shared JWT authentication.

## Included Features

### A track
- Auth: registration with email OTP, JWT login
- Search: multi-tier signal fusion (Tier 0 EXIF → Tier 1 parallel Vision APIs → Tier 2 GPT main voter → Tier 3 GPT arbiter) with cross-image cluster reweight
- Gallery: collections, save / move / rename / delete, image viewer modal, photo editing
- Journal: per-photo CLIP + GPT generation, diary-style viewer, stats with 5-level gamification, Wikipedia-backed recommendations
- Geocoding: reverse-geocode endpoint for editable map pins
- Alembic-managed schema migrations

### B track
- Profile and Settings UI with display name, bio, theme, privacy default, email-notifications
- Live Chat: 13 permanent tag-based lounges, WebSocket real-time + REST fallback, gallery photo attachment
- Admin Panel: user management (role / status toggle), moderation queue
- Bug Report flow from Settings → admin moderation queue
- Docker Compose deployment with backend + frontend + Postgres

## Run Locally with Docker

```bash
cp .env.example .env
# Fill OPENAI_API_KEY, GOOGLE_MAPS_API_KEY, JWT_SECRET, EMAIL_FROM, EMAIL_PASSWORD.
docker compose up --build
```

Service URLs:

- Frontend: `http://localhost`
- Backend interactive docs (Swagger): `http://localhost:8000/docs`
- Backend health: `http://localhost:8000/api/health`

Stop the stack:

```bash
docker compose down            # Keeps the named volumes (postgres_data, uploads_data)
docker compose down -v         # Wipes the database and uploaded files as well
```

## Seed Demo Users and Sample Chat Messages

For local testing and the demo presentation, set this in `.env` before the first build:

```env
SEED_DB_ON_START=true
```

or run the seed script manually after the containers are up:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

Sample accounts (both use password `Travel2026!`):

| Role | Email | User ID |
|---|---|---|
| Admin | `jaemin@example.com` | `jaemin001` |
| Traveler | `mina@example.com` | `traveler102` |

The seed script also writes a few sample messages into the chat lounges so the rooms do not look empty during the first demo.

## Database Migration

The backend's `start.sh` runs `alembic upgrade head` before exec'ing Uvicorn. Every container start re-applies any pending migration automatically.

Full migration chain in the final release:

| Revision | Adds |
|---|---|
| `5170ad3cfe71` | Initial auth tables (`users`, `otps`) and `image_metadata`. |
| `b2f9c41dd7a3` | Journal schema (`journals`, `journal_entries`, `clip_cache`, `places_cache`) and the `user_id` FK on `image_metadata`. |
| `c4a8e91f5d12` | `saved_places` table for the Gallery feature. |
| `d92a1b3e7c45` | `image_metadata_id` FK on `saved_places` — the bridge that makes Journal eligibility possible. |
| `e7b1c2d3a4f5` | B-track social tables: `user_settings`, `chat_messages`, `moderation_items`. |
| `f8a2c7d1e9b3` | `image_url` column on `chat_messages` for gallery photo attachment. |
| `b9c3e1f7d2a8` | Repaired `chat_rooms` schema for the 13-lounge model. |
| `c7d4f2e8b1a9` | `tags` column on `image_metadata` (Search → Lounge tagging). |
| `d5e6f7a8b9c0` | `privacy` column on `saved_places` (private / unlisted / public). |

Expected head after a successful `alembic upgrade head`:

```text
d5e6f7a8b9c0
```

Confirm with:

```bash
docker compose exec backend alembic current
```

## Final Deployment Checklist

Before submitting or deploying:

1. Copy `.env.example` to `.env` and fill every required key.
2. Set a strong `JWT_SECRET` (long random string).
3. Set `OPENAI_API_KEY` for Search Tier 2/3 and Journal generation.
4. Set `GOOGLE_MAPS_API_KEY` for Vision (Landmark / OCR / Logo / Web / Label), Geocoding, and Places.
5. Set `EMAIL_FROM` and `EMAIL_PASSWORD` (Gmail App Password) if registration OTP is required.
6. Run `docker compose down -v` then `docker compose up --build` from a clean state.
7. Open `/docs` and confirm A-track and B-track endpoints both appear.
8. Run `docker compose exec backend python -m app.scripts.seed_complete` to create demo accounts.
9. Confirm `docker compose exec backend alembic current` prints `d5e6f7a8b9c0`.
10. Confirm `chat_rooms` table contains 13 rows.
11. Log in and walk through every smoke test item in `docs/FINAL_DEPLOYMENT_CHECKLIST.md`.
12. Verify Live Chat WebSocket is online (status banner reads "WebSocket online").
13. Submit a test bug report from Settings and confirm it appears in the admin moderation queue.
14. Note any failing items in GitHub Issues (`docs/BUG_TRACKING.md` describes the process).

## Git Merge Note

The final integrated repository uses A-track code as the base and adds B-track files on top. The earlier B-track mock authentication header has been removed; every B-track endpoint now depends on `app.core.deps.get_current_user` (and `require_admin` for admin handlers) so authentication is unified across both tracks.

## Common Operational Notes

- The Docker Postgres container exposes `5432:5432` to the host, which means the local `.venv` backend can also connect to it directly when you prefer the hot-reload developer loop (`docker compose up -d db` + local `uvicorn`).
- Uploaded gallery files persist in the named volume `uploads_data` mounted at `/app/uploads` inside the backend container. `docker compose down -v` wipes them; `docker compose down` without `-v` keeps them.
- The CLIP model is downloaded on the first journal generation; if your container has limited RAM, allocate at least 4 GB. Without this the worker can crash during model load.
- All external API keys are passed through environment variables — no key is hard-coded anywhere in the repo.
