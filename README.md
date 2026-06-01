# Travel From Photo

Travel From Photo is an AI-powered web application that helps users recover likely travel locations from uploaded photos. A user uploads an image, the backend fuses signals from multiple vision and map APIs, and returns ranked location candidates with confidence scores. Users can save results to a personal gallery, generate travel journals, and join tag-based travel chat lounges with other users.

---

## Team Members

| Name | Role |
|------|------|
| Jaemin Jeon | Frontend, Backend Integration, Social Track |
| Younghak Yoo | Frontend, Backend Integration, Image Track(Search, Journal, Gallery) |

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Checking Out the Source Code](#1-checking-out-the-source-code)
4. [Environment Configuration](#2-environment-configuration)
5. [Option A — Build and Run with Docker (Recommended)](#3-option-a--build-and-run-with-docker-recommended)
6. [Option B — Run Locally Without Docker](#4-option-b--run-locally-without-docker)
7. [Database Setup and Migrations](#5-database-setup-and-migrations)
8. [Test Accounts and Admin Access](#6-test-accounts-and-admin-access)
9. [Testing the Application](#7-testing-the-application)
10. [Build Verification](#8-build-verification)
11. [API Reference](#9-api-reference)
12. [Important Notes](#10-important-notes)

---

## System Architecture

### Docker deployment (production)

```
Browser
  │
  ├─► port 80   → frontend container (Nginx)
  │                  ├─ serves React static files
  │                  ├─ /api/*      → proxy → backend:8000
  │                  ├─ /uploads/*  → proxy → backend:8000
  │                  └─ WebSocket upgrade (ws/wss) → backend:8000
  │
  └─► port 8000 → backend container (FastAPI / Uvicorn)
                      │
                      ├─ PostgreSQL (db container, port 5432)
                      ├─ OpenAI API (image location analysis, journal generation)
                      └─ Google Maps / Vision API (landmark, geocoding, places, Logo, OCR, Web)
```

The frontend container runs Nginx, which serves the compiled React app and proxies all `/api/*` and `/uploads/*` requests to the backend. The browser communicates with port 80 for the app. All three containers are managed by Docker Compose.

### Local development (without Docker)

```
Browser (localhost:5173) → Vite dev server → React app
Browser (localhost:8000) → FastAPI (Uvicorn, --reload)
                               └─ PostgreSQL (local or Docker)
```

Nginx is not used during local development. The Vite dev server communicates with the backend at `http://localhost:8000/api`.

---

## Prerequisites

### Docker setup (recommended)

| OS | Requirement |
|----|-------------|
| Windows 10/11 | Docker Desktop 4.x with WSL 2 backend enabled |
| macOS | Docker Desktop 4.x |
| Linux | Docker Engine + Docker Compose plugin (`apt install docker-compose-plugin`) |

```bash
docker --version        # 24.x or later
docker compose version  # v2.x or later
```

### Local setup (without Docker)

| Tool | Version |
|------|---------|
| Python | 3.10 or later |
| Node.js | 20 LTS or later |
| PostgreSQL | 14 or later |

---

## 1. Checking Out the Source Code

```bash
git clone https://github.com/jimpmg123/travel-from-photo.git
cd travel-from-photo
```

**Stable release:**

```bash
git checkout main
```

**Latest development:**

```bash
git checkout dev
```

**Update after initial checkout:**

```bash
git pull
```

---

## 2. Environment Configuration

Create a `.env` file in the `backend/` directory and fill in your values:

```env
# Required for Search (image location analysis) and Journal generation
OPENAI_API_KEY=sk-...

# Required for landmark detection, geocoding, and Places lookup
GOOGLE_MAPS_API_KEY=AIza...

# Used to sign JWT tokens. Replace with a long random string before deployment.
# Generate one: python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=change-this-in-production

# JWT algorithm — leave as HS256
JWT_ALGORITHM=HS256

# Token expiry in minutes (e.g. 60 = 1 hour, 10080 = 7 days)
JWT_EXPIRE_MINUTES=60

# Required for registration OTP emails.
# EMAIL_FROM must be a Gmail address.
# EMAIL_PASSWORD must be a Gmail App Password (not your regular password).
# Generate one at: Google Account → Security → 2-Step Verification → App passwords
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
```

> **Note:** Without `OPENAI_API_KEY`, the AI reasoning tier in Search is skipped and journal generation will not produce text. Without `GOOGLE_MAPS_API_KEY`, location resolution and geocoding will not work. Both keys are required for full functionality.

---

## 3. Option A — Build and Run with Docker (Recommended)

This is the fastest way to get the full stack running. Docker builds all three services and wires them together automatically.

```bash
docker compose up --build
```

First build takes 3–8 minutes (Python and npm dependencies). Subsequent starts are faster:

```bash
docker compose up
```

| URL | Purpose |
|-----|---------|
| `http://localhost` | Main application |
| `http://localhost:8000/docs` | Interactive API documentation (Swagger UI) |
| `http://localhost:8000/api/health` | Backend health check |

Stop all containers:

```bash
docker compose down
```

Full reset including all database data:

```bash
docker compose down -v
```

**Windows:** If port 80 is in use (IIS or another process), set `FRONTEND_HOST_PORT=3000` in `.env` and open `http://localhost:3000`.

**macOS Apple Silicon (M1/M2/M3):** Docker Desktop handles ARM cross-compilation automatically. No extra steps needed.

---

## 4. Option B — Run Locally Without Docker

Use this if you want fast backend hot-reload during development. You still need a PostgreSQL instance running.

### Step 1 — Start only the database

Using Docker for just the database is the easiest option:

```bash
docker compose up -d db
```

Or use a local PostgreSQL installation. The backend connects using these defaults: `travel_user / travel_password @ 127.0.0.1:5432 / travel_db`. These can be overridden by setting `DATABASE_URL` directly in `backend/.env`.

### Step 2 — Run the backend

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Windows (PowerShell):**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Backend is ready when you see:

```
INFO:     Application startup complete.
```

### Step 3 — Run the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## 5. Database Setup and Migrations

Alembic manages all schema changes. Run this after the first checkout, after pulling new code, or whenever migration files change:

```bash
cd backend
alembic upgrade head
```

### Migration history

| Revision | Description |
|----------|-------------|
| `5170ad3cfe71` | Initial auth, users, image metadata, saved places |
| `b2f9c41dd7a3` | Journal and journal entry schema |
| `c4a8e91f5d12` | Saved places |
| `d92a1b3e7c45` | Image metadata → saved place foreign key |
| `e7b1c2d3a4f5` | Social tables: user settings, chat rooms, chat messages, moderation items |
| `f8a2c7d1e9b3` | `chat_messages.image_url` column |
| `b9c3e1f7d2a8` | Repair chat_rooms table and fix chat_messages schema |
| `c7d4f2e8b1a9` | `image_metadata.tags` column |
| `d5e6f7a8b9c0` | `saved_places.privacy` column |

Check current state:

```bash
cd backend
alembic current   # show applied revision
alembic heads     # show expected head revision
```

---

## 6. Test Accounts and Admin Access

### Seed demo data

After the backend is running, execute the seed script once:

**Docker:**

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

**Local — Windows:**

```powershell
cd backend
.venv\Scripts\python.exe -m app.scripts.seed_complete
```

**Local — macOS/Linux:**

```bash
cd backend
python -m app.scripts.seed_complete
```

### Test account credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `jaemin@example.com` | `Travel2026!` |
| Traveler | `mina@example.com` | `Travel2026!` |

### Accessing the Admin Panel

Log in with the admin account. The **Admin** tab appears in the navigation bar (admin role only). The admin panel provides:

- User list with search, role toggle (traveler ↔ admin), and account enable/disable
- Moderation queue showing bug reports submitted by users and other flagged items

### Promoting an existing account to admin

**Via Docker:**

```bash
docker compose exec db psql -U travel_user -d travel_db \
  -c "UPDATE users SET role = 'admin' WHERE email = 'your@email.com';"
```

**Local psql:**

```bash
psql -U travel_user -d travel_db \
  -c "UPDATE users SET role = 'admin' WHERE email = 'your@email.com';"
```

Log out and log back in after the update.

---

## 7. Testing the Application

The project does not include automated unit tests. Testing is performed by walking through the core user flows described below.

### Manual test checklist

| # | Feature | Steps | Expected result |
|---|---------|-------|-----------------|
| 1 | **Registration** | Sign Up → fill form → enter OTP sent to email | Account created, redirected to home |
| 2 | **Login** | Enter credentials → submit | JWT token issued, home page loads |
| 3 | **Search** | Upload a travel photo + optional country/city hint → Run Search | Location candidates returned within ~30 seconds |
| 4 | **Gallery save** | From Search results → Save a candidate to gallery | Photo appears in Gallery with map pin |
| 5 | **Gallery browse** | Open Gallery → view collections, rename, delete | Collections and photos display correctly |
| 6 | **Journal creation** | Gallery → select photos → Create Journal → wait | Journal entries with AI-written text generated per photo |
| 7 | **Journal detail** | Open a saved journal → browse entries with arrow keys | Entry photos and journal text displayed per entry |
| 8 | **Live Chat** | Chat → select a lounge → send a message | Message appears in real time |
| 9 | **Chat from Search** | After Search, click the recommended lounge link | Chat opens with matching tag lounge pre-selected |
| 10 | **Dark mode** | Settings → Theme: Dark → Save | Page background and panels turn dark immediately |
| 11 | **Bug report** | Settings → Report a bug → fill form → submit | Success message; item appears in Admin moderation queue |
| 12 | **Admin panel** | Log in as admin → open Admin tab | User table and moderation queue load correctly |

### API health check

```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

### Interactive API docs

Open `http://localhost:8000/docs` in a browser to see all endpoints, inspect request and response schemas, and send test requests directly.

### WebSocket connectivity

The Live Chat panel header shows the connection state:

- **WebSocket online** — real-time connection active
- **REST polling fallback** — WebSocket unavailable; messages refresh every 15 seconds

Both modes deliver messages. The fallback activates automatically.

---

## 8. Build Verification

Run these checks before committing or deploying:

**Frontend TypeScript check and production build:**

```bash
cd frontend
npm run build
# Success: prints "✓ built in Xs" with no errors
```

**Backend syntax check:**

```bash
cd backend
python -m compileall -q app
# No output = no syntax errors
```

**Migration chain integrity:**

```bash
cd backend
alembic check
```

**Docker end-to-end build test:**

```bash
docker compose build
docker compose up -d
curl http://localhost/api/health   # Expected: {"status":"ok"}
docker compose down
```

---

## 9. API Reference

All endpoints are prefixed with `/api`. Full interactive documentation is available at `http://localhost:8000/docs` when the backend is running.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new account (triggers OTP email) |
| `POST` | `/api/auth/verify-otp` | Verify the 6-digit OTP to activate account |
| `POST` | `/api/auth/login` | Log in and receive a JWT token |
| `GET` | `/api/auth/me` | Get the current user's basic info |

### User profile and settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/me` | Get full profile for current user |
| `GET` | `/api/profile` | Get profile details |
| `PUT` | `/api/profile` | Update profile (name, bio, email) |
| `GET` | `/api/settings` | Get user settings (theme, privacy, notifications) |
| `PATCH` | `/api/settings` | Update user settings |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/image` | Upload a photo for location analysis; returns ranked candidates |

### Gallery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/gallery/collections` | List all saved places grouped by collection |
| `POST` | `/api/gallery/saves` | Save a location result to gallery |
| `PATCH` | `/api/gallery/saves/{save_id}` | Update a saved place (name, collection, coordinates) |
| `DELETE` | `/api/gallery/saves/{save_id}` | Delete a saved place |
| `POST` | `/api/gallery/collections/rename` | Rename a collection |
| `DELETE` | `/api/gallery/collections/{collection_name}` | Delete all saves in a collection |

### Journal

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/journals/generate` | Start a journal generation job (background task) |
| `GET` | `/api/journals/jobs/{job_id}` | Poll job status |
| `GET` | `/api/journals` | List all journals for current user |
| `GET` | `/api/journals/{journal_id}` | Get journal detail with all entries |
| `PATCH` | `/api/journals/{journal_id}` | Edit journal title or entry text |
| `DELETE` | `/api/journals/{journal_id}` | Delete a journal |
| `GET` | `/api/journals/stats` | Get travel statistics (countries, cities, photo count) |
| `GET` | `/api/journals/recommendations` | Get AI-generated next destination recommendations |

### Live Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat-rooms` | List all 13 tag-based lounges |
| `GET` | `/api/chat-rooms/recommendations` | Get lounges recommended for given tags or image |
| `GET` | `/api/chat-rooms/{room_id}/messages` | Get recent messages in a lounge |
| `POST` | `/api/chat-rooms/{room_id}/messages` | Send a message via REST (WebSocket fallback) |
| `POST` | `/api/chat-tags/normalize` | Map search analysis output to lounge tag keys |
| `WS` | `/api/ws/chat/{room_id}?token=JWT` | WebSocket connection for real-time chat |

### Geocoding

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/geocode/reverse` | Reverse geocode coordinates to a place name |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reports` | Submit a bug report (any authenticated user) |

### Admin (admin role required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/summary` | Dashboard counts (users, open moderation items, chat messages) |
| `GET` | `/api/admin/users` | List users with optional search query |
| `PATCH` | `/api/admin/users/{user_id}` | Update user role or status |
| `GET` | `/api/admin/moderation` | List all moderation items including bug reports |
| `POST` | `/api/admin/moderation` | Create a moderation item (admin-initiated) |
| `PATCH` | `/api/admin/moderation/{item_id}` | Resolve a moderation item |

---

## 10. Important Notes

- **Do not commit `.env` files.** They are listed in `.gitignore`.
- **Do not commit API keys** to any file tracked by git.
- **Registration requires working email credentials.** For local testing without email, use the seeded demo accounts instead.
- **Search quality depends on API keys.** Without `OPENAI_API_KEY`, the AI reasoning tier is skipped and results rely on Google Vision signals only. Without `GOOGLE_MAPS_API_KEY`, location resolution and geocoding do not work.
- **CLIP/Torch requires at least 4 GB RAM.** On machines with less memory, the backend may crash on startup when loading the model.
- **Run `alembic upgrade head` after pulling new code** that adds migration files. If the gallery fails to load or journal generation returns a 500 error, a pending migration is the most likely cause.
- Uploaded gallery files are stored in `backend/uploads/gallery/` and served at `/uploads/gallery/<filename>`. This directory is excluded from git.
- Google Vision API calls are authenticated via `GOOGLE_MAPS_API_KEY`. No separate service account file is required.
