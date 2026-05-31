# Travel From Photo

Travel From Photo is a web application that helps users recover likely travel locations from photos. A user uploads an image, the backend analyzes visual clues, and the app returns possible places with confidence scores. Users can save results to a gallery, create travel journals, and join tag-based travel chat lounges.

## Current Project Scope

The merged deployment version includes:

- Auth, register, login, and JWT-protected routes
- Search with image analysis and location candidates
- Gallery save and browse flow
- Journal draft and saved journal flow
- Profile and Settings pages
- Admin Panel for user management and moderation
- Live Chat with 13 permanent tag-based lounges
- PostgreSQL database with Alembic migrations
- Docker Compose deployment for frontend, backend, and database

## Team Members

- Jaemin Jeon
- Younghak Yoo
- Jinu Hong

## Problem Statement

Travelers often lose location information when photos are moved, uploaded, or shared. Later, they may remember the memory but not the exact place. Existing image search tools can return broad or unclear results, especially for food photos, indoor places, or visually generic scenes. Travel From Photo gives users a focused workflow: upload one photo, review likely location candidates, select or manually correct the result, then save it for future memories.

## System Overview

```text
React/Vite frontend
        ↓
Nginx reverse proxy
        ↓
FastAPI backend
        ↓
PostgreSQL database
```

External services such as OpenAI and Google APIs are configured through environment variables. Search and journal features may require valid API keys.

## Supported Operating Systems

These instructions are intended for:

- Windows 10/11 with Docker Desktop
- macOS with Docker Desktop
- Linux with Docker Engine and Docker Compose plugin

## Quick Start with Docker

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```text
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=replace-with-a-long-random-string
```

Then run:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost`
- Backend docs: `http://localhost:8000/docs`
- Backend health: `http://localhost:8000/api/health`

## Local Test Accounts

Seed local test data after Docker is running:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

Use these accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `jaemin@example.com` | `Travel2026!` |
| Traveler | `mina@example.com` | `Travel2026!` |

Admin users can access the Admin Panel. Traveler users are redirected away from the Admin route.

## Build and Test Without Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate  # Windows PowerShell
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm run dev
```

Vite dev server:

```text
http://localhost:5173
```

## Final Verification Commands

Frontend build:

```bash
cd frontend
npm install
npm run build
```

Backend compile check:

```bash
cd backend
python -m compileall -q app
```

Alembic head check:

```bash
cd backend
alembic heads
```

Docker smoke test after seeding:

```bash
python scripts/local_smoke_check.py
```

## Database

The project uses PostgreSQL. The backend applies Alembic migrations on startup through `backend/start.sh`.

Final migration head:

```text
e7b1c2d3a4f5
```

The B-track social migration adds:

- `user_settings`
- `chat_rooms`
- `chat_messages`
- `moderation_items`
- `image_metadata.tags`

## Live Chat Tag Lounges

Live Chat uses 13 permanent tag-based lounges instead of city-specific rooms. Search analysis produces tags such as `historical`, `urban`, `food`, or `sunset`. The results page recommends matching lounges and routes users into Live Chat.

Key endpoints:

```text
GET  /api/chat-rooms
GET  /api/chat-rooms/{room_id}/messages?limit=50
POST /api/chat-rooms/{room_id}/messages
WS   /api/ws/chat/{room_id}?token=JWT
POST /api/chat-tags/normalize
```

More detail is in `docs/LIVE_CHAT_TAG_LOUNGES.md`.

## API Documentation

- Final API design: `docs/API_DESIGN_FINAL.md`
- Live Chat design: `docs/LIVE_CHAT_TAG_LOUNGES.md`
- Deployment checklist: `docs/FINAL_DEPLOYMENT_CHECKLIST.md`
- Test plan: `docs/FINAL_TEST_PLAN.md`

## Bug Tracking

Use GitHub Issues for bugs. A bug report template is included in:

```text
.github/ISSUE_TEMPLATE/bug_report.md
```

Bug tracking instructions are in:

```text
docs/BUG_TRACKING.md
```

For completed features, someone who did not implement the feature should verify it and open an issue for any problem found.

## Milestone 4 Documents

For the beta release assignment, update or submit:

- README setup/build/test instructions
- Final API documentation
- Updated schedule/progress notes
- Bug tracking list
- Individual and group progress update
- Deployment link

A template is provided in:

```text
docs/MILESTONE_4_PROGRESS_UPDATE_TEMPLATE.md
```

## Important Notes

- Do not commit `.env` files.
- Do not commit API keys.
- Do not commit `frontend/node_modules`, `frontend/dist`, backend caches, or uploaded runtime files.
- Registration uses email OTP. For local testing, the seeded accounts are easier unless email credentials are configured.
- Search quality depends on image clues and external API responses.
