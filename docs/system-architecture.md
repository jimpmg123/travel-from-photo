# System Architecture

This document describes the system architecture of Travel From Photo as implemented in the final release. It covers the technology stack, backend module layout, the multi-tier image search pipeline, the database schema, authentication, the live chat real-time path, and the deployment topology. A short section at the end records design decisions that were descoped from the original plan and the rationale.

## 1. Technology Stack

### Frontend

| Concern | Choice |
|---|---|
| Framework | React 19 |
| Build tool | Vite 7 |
| Language | TypeScript 5 (strict mode) |
| Routing | React Router 7 |
| Maps | Leaflet 1.9 via react-leaflet 5 (OpenStreetMap tiles) |
| Icons | lucide-react |
| State | Component-local state + React Context (auth, journal job) |

### Backend

| Concern | Choice |
|---|---|
| Framework | FastAPI |
| Language | Python 3.11 |
| ORM | SQLAlchemy 2.x (Mapped column style) |
| Migration | Alembic |
| ASGI server | Uvicorn |
| Image I/O | Pillow, OpenCV (for CLAHE / sharpening / orientation) |
| EXIF | exifread |
| HTTP client | httpx / requests |

### Database

PostgreSQL 16 (Bitnami container). Single database `travel_db` shared by all features. Connection via `psycopg` async-compatible driver.

### AI / Vision Services

| Service | Role |
|---|---|
| OpenAI Vision (gpt-4.1-mini) | Tier 2 location voter + Tier 3 arbiter + Journal narrative generation |
| Google Vision API | Landmark detection, OCR, logo detection, web entity detection, label detection |
| CLIP ViT-B/32 (HuggingFace) | Local visual classification for the Journal subject/atmosphere/activity vocabulary |
| Google Geocoding | Address ↔ coordinates resolution and reverse-geocoding for editable map pins |
| Google Places | Place ID and structured place fields used by candidate normalization |

### Real-time

FastAPI native `WebSocket` route with a custom `ConnectionManager` that maps `room_id → Set[WebSocket]`. REST polling is the automatic fallback for clients unable to upgrade.

### Authentication

JWT (HS256) issued on successful login. Registration uses email OTP sent over Gmail SMTP. Role-based access control with two roles: `traveler` (default) and `admin`.

### Containerization

Docker Compose orchestrates three services: `db` (Postgres), `backend` (FastAPI behind Uvicorn), and `frontend` (Nginx serving the compiled React app + proxying `/api/*` and `/uploads/*` to the backend).

## 2. Backend Module Map

```text
backend/app/
├── main.py                       # FastAPI app factory + router registration
├── core/
│   ├── config.py                 # Env var loader (.env)
│   ├── db.py                     # SQLAlchemy engine + SessionLocal + Base
│   ├── deps.py                   # FastAPI dependencies (get_current_user, require_admin)
│   ├── security.py               # Password hash + JWT encode/decode
│   └── init_db.py                # Table creation utility (used by alembic env)
│
├── auth/
│   ├── router.py                 # /auth/register, /auth/verify-otp, /auth/login, /auth/me
│   ├── service.py                # Registration, OTP issue/verify, login
│   ├── repository.py             # User queries
│   ├── schemas.py                # Pydantic request/response models
│   └── models.py                 # OTP table
│
├── routers/
│   ├── image.py                  # POST /image — Search pipeline entry point
│   ├── gallery.py                # /gallery/collections, /gallery/saves CRUD
│   ├── journal.py                # /journals CRUD + jobs + stats + recommendations
│   ├── chat.py                   # /chat-rooms, /chat-tags/normalize, WebSocket /ws/chat
│   ├── geocode.py                # /geocode/reverse for editable map pins
│   ├── profile.py                # /profile, /settings, /users/me
│   ├── admin.py                  # /admin/* — role-guarded
│   └── reports.py                # /reports — user bug reports → moderation queue
│
├── models/
│   ├── user.py                   # users
│   ├── image_metadata.py         # image_metadata (file info, EXIF, GPS, tags)
│   ├── saved_place.py            # saved_places (gallery items)
│   ├── journal.py                # journals + journal_entries
│   ├── social.py                 # user_settings, chat_rooms, chat_messages, moderation_items
│   └── cache.py                  # clip_cache, places_cache
│
├── repositories/                 # Pure DB query layer used by routers
│   ├── image_metadata_repository.py
│   └── journal_repository.py
│
├── schemas/                      # Pydantic API models grouped by feature
│
├── services/
│   ├── search/                   # Multi-tier search pipeline (see Section 3)
│   │   ├── search_service.py         # Orchestrator
│   │   ├── exif_gps_resolver_service.py
│   │   ├── tier1_collector_service.py
│   │   ├── get_main_engine_service.py    # GPT main voter (Tier 2)
│   │   ├── gpt_arbiter_service.py        # GPT arbiter (Tier 3)
│   │   ├── candidate_normalizer_service.py
│   │   ├── candidate_scorer_service.py
│   │   ├── image_ingestion_service.py
│   │   └── contracts.py              # Dataclasses for signals, candidates
│   │
│   ├── journal/                  # Journal generation pipeline (see Section 8)
│   │   ├── journal_jobs.py
│   │   ├── clip_journal_service.py
│   │   ├── gpt_vision_service.py
│   │   ├── stats_service.py
│   │   ├── cache_service.py
│   │   └── recommendation_service.py
│   │
│   ├── chat_tags.py              # Vision-label → 13 standard tag mapping
│   │
│   └── shared/                   # Cross-feature integrations
│       ├── exif_service.py
│       ├── image_preprocessing_service.py
│       ├── geocoding_service.py
│       ├── places_service.py
│       ├── landmark_detection_service.py
│       ├── ocr_service.py
│       ├── logo_detection_service.py
│       ├── web_detection_service.py
│       ├── label_detection_service.py
│       ├── openai_location_service.py
│       └── clip_service.py
│
└── scripts/
    └── seed_complete.py          # Seeds demo users + sample chat messages
```

Each router is a thin HTTP adapter. Business logic lives in `services/`. Repositories isolate the SQLAlchemy query patterns from request handling.

## 3. Search Pipeline

The Search pipeline is the technical centerpiece of the project. It treats location identification as a **multi-tier signal fusion problem** rather than a single classification task. Each photo is independently processed through up to four sequential tiers, stopping early when a confident result is reached.

### 3.1 Per-photo tier flow

```text
POST /api/image  (multipart: file + optional country/city hints)
            │
            ▼
   Image preprocessing
   (original + processed copies)
            │
            ▼
   ┌──────────────────────────────┐
   │ Tier 0 — EXIF GPS shortcut   │
   │ If EXIF contains GPS, run    │
   │ reverse-geocoding + Places.  │
   │ Returns 1 candidate, score=1 │
   └──────────────────────────────┘
        │ no GPS
        ▼
   ┌──────────────────────────────────────────┐
   │ Tier 1 — Light parallel signals (≤10 s)  │
   │ asyncio.to_thread × 4:                   │
   │   • OCR              (country lang hint) │
   │   • Landmark Detection                   │
   │   • Web Detection    (multi sub-signals) │
   │   • Logo Detection                       │
   │ Each call has its own 4.5 s timeout.     │
   └──────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────┐
   │ Noise filter                             │
   │ Rejects file names, mixed-script garbage,│
   │ URL fragments, too-short / too-long text.│
   └──────────────────────────────────────────┘
        │
        ▼
   Candidate normalizer
   • Parallel Places/Geocoding per signal
   • Cluster by place_id / proximity (~1 km)
   • Hierarchical merge ("Paris" → "Eiffel Tower")
        │
        ▼
   Scorer
   Σ(source_prior × signal_score)
      × mechanism-independence bonus
        │
        ▼
   Hint reweight
   (country / city match × 1.3 / 1.2,
    mismatch × 0.4 / 0.5)
        │
        ▼
   Verdict (confident / likely / suggestions / failed)
        │
        ▼
   If verdict ∉ {confident, likely}:
   ┌──────────────────────────────────────────┐
   │ Tier 2 — GPT-4o main voter (≤13 s)       │
   │ Calls Vision Label Detection first to    │
   │ extract hard visual constraints (Bridge, │
   │ Mountain, etc.), then prompts GPT-4o as  │
   │ an INDEPENDENT voter that does not see   │
   │ Tier 1 candidates.                       │
   └──────────────────────────────────────────┘
        │
        ▼
   Re-normalize, re-score, re-reweight
        │
        ▼
   If verdict still weak:
   ┌──────────────────────────────────────────┐
   │ Tier 3 — GPT-4o arbiter (≤14 s)          │
   │ Re-ranks the EXISTING candidate set.     │
   │ Does NOT propose new candidates → no     │
   │ hallucination risk.                      │
   └──────────────────────────────────────────┘
            │
            ▼
   Response: ranked candidates + verdict + tier_reached
```

### 3.2 Cross-image post-processing

When multiple photos are uploaded in the same Search request, an additional layer runs in the frontend after all per-photo responses arrive:

```text
Phase 1 — Per-photo tier flow (above), in parallel for every photo
        │
        ▼
Phase 2 — Cluster reweight
  • Collect anchor points (top candidate of confident/likely photos, score ≥ 0.5)
  • Compute median latitude / longitude (robust to outliers)
  • For every candidate (top + alternates) in every photo, multiply its score
    by a distance-based factor:
       <5 km  ×1.35
       <20 km ×1.20
       <100 km ×1.00
       <500 km ×0.65
       ≥500 km ×0.35
  • Re-sort, re-rank
        │
        ▼
Phase 3 — Cluster-derived GPT retry
  • Identify the dominant country / city across confident photos
  • For photos still verdict ≠ confident OR top candidate disagrees with
    the cluster, re-call the backend Tier 2 with cluster country / city
    forced as the hint (overriding any user-supplied hint)
  • Apply cluster reweight one more time
```

This compensates for the inherent variance of probabilistic Vision APIs — the same place photographed from different angles can produce very different Web Detection / Landmark Detection responses.

### 3.3 Visual content constraint in Tier 2

Before Tier 2 prompts GPT-4o, the backend calls Google Vision Label Detection and extracts the top labels (Bridge, Beach, Mountain, Temple, etc.). These labels are passed to GPT as a **hard constraint**: candidate proposals whose physical type contradicts the visual labels must be rejected. This addresses the failure mode where GPT, given only a city hint, returns the most famous landmark in that city regardless of what is actually in the photo.

### 3.4 Diagnostics

The response includes the `contributing_sources` array on each candidate, the `verdict` band, and the `tier_reached` integer. The frontend renders a "How we got this result" panel that shows which signal sources hit (✓) and which did not (—), plus an actionable tip when the result is weak (e.g., "Only one signal contributed — a head-on shot with the subject filling 60%+ of the frame often unlocks Landmark / Web matches").

## 4. Database Schema

```text
users ─────┬── otps (email verification)
           │
           ├── image_metadata ───────┬── journal_entries
           │                         │
           ├── saved_places ─────────┘   (image_metadata_id FK)
           │
           ├── journals ──── journal_entries
           │
           ├── user_settings
           ├── chat_messages   (sender_user_id)
           ├── moderation_items (reporter_user_id)
           └── (role column → admin / traveler)

chat_rooms ── chat_messages (room_id)
            (13 permanent rows seeded by ensure_chat_rooms())

clip_cache    (image_id, vocab_version) → CLIP labels
places_cache  (rounded_lat, rounded_lng) → cached Places lookup
```

### 4.1 Notable design choices

- **`saved_places.image_metadata_id`** is a nullable FK back to `image_metadata`. When a user saves a Search result, the backend parses EXIF from the just-saved file, creates an `image_metadata` row, and links the saved place to it. This is the bridge that makes Journal eligibility possible: a saved place is journal-eligible only if its linked `image_metadata` has `has_gps = True` (i.e., the original photo carried real EXIF GPS, not a search-resolved fallback).
- **`image_metadata.tags`** stores the standard 13 lounge tag keys derived during Search. This decouples the chat lounge system from the Search pipeline at the DB level.
- **`chat_rooms`** has exactly 13 permanent rows, seeded on backend startup. Messages reference rooms by ID, not by a free-text room key, which prevents accidental room fragmentation.
- **`clip_cache`** and **`places_cache`** persist deterministic outputs across journal runs and search calls so re-runs do not re-pay for the same external work.

### 4.2 Migration chain

| Revision | Adds |
|---|---|
| `5170ad3cfe71` | Initial auth (users, otps) and image_metadata |
| `b2f9c41dd7a3` | Journal schema + clip_cache + places_cache + user_id FK on image_metadata |
| `c4a8e91f5d12` | saved_places |
| `d92a1b3e7c45` | image_metadata_id FK on saved_places (Journal eligibility bridge) |
| `e7b1c2d3a4f5` | Social tables (user_settings, chat_messages, moderation_items) |
| `f8a2c7d1e9b3` | image_url column on chat_messages (photo attachment) |
| `b9c3e1f7d2a8` | Repaired chat_rooms schema (13-lounge migration) |
| `c7d4f2e8b1a9` | tags column on image_metadata (Search → Lounge tagging) |
| `d5e6f7a8b9c0` | privacy column on saved_places |

Expected `alembic current` head: `d5e6f7a8b9c0`.

## 5. Authentication and Authorization

### 5.1 Registration

1. User submits `POST /auth/register` with first/last name, user ID, email, and password.
2. Backend hashes the password with bcrypt and creates a `users` row with `is_active=False`.
3. A 6-digit OTP is generated, stored in the `otps` table with a TTL, and emailed via SMTP (Gmail App Password).
4. `POST /auth/verify-otp` validates the code, marks the account active.

### 5.2 Login

`POST /auth/login` validates the password, then issues a JWT (HS256) containing:

```json
{
  "sub": "<user.id as string>",
  "role": "traveler" | "admin",
  "exp": <epoch timestamp>
}
```

The token is stored in `localStorage` on the client. Token lifetime defaults to 7 days (`JWT_EXPIRE_MINUTES=10080`); the frontend triggers an automatic local logout on any 401 response so an expired token never sticks around.

### 5.3 Authorization

`app/core/deps.py` provides two FastAPI dependencies:

- `get_current_user(credentials, db)` — decodes the JWT, loads the user, raises 401 if inactive.
- `require_admin(current_user)` — additionally checks `role == 'admin'`, raises 403 otherwise.

Admin endpoints are guarded at both the **frontend route level** (`/admin` redirects non-admins) and the **backend dependency level** (every admin handler depends on `require_admin`). The dual check means a UI bypass cannot escalate privilege.

## 6. Image Upload and Storage

### 6.1 Validation

- Frontend: MIME type check, max size, basic file-name sanity. Bad files cancel the entire batch to keep the upload state unambiguous.
- Backend (Search): The Cloud Vision and OpenAI APIs themselves perform implicit format checks. The Pillow open + EXIF parse step rejects non-image files. Gallery save additionally enforces a size limit and stores under a UUID-derived filename to prevent path injection.

### 6.2 Preprocessing

`image_preprocessing_service.preprocess_image()` produces two derived copies:

- **Original** — used by Web Detection (image-hash matching depends on byte fidelity) and GPT-4o.
- **Processed** — used by OCR, Landmark, Logo. The processing applies:
  - EXIF orientation tag correction (Pillow occasionally misses this)
  - CLAHE adaptive contrast when mean brightness is low (night / indoor shots)
  - Laplacian-variance blur detection → unsharp mask when blurry
  - Hough-line dominant-angle rotation correction (corrects 1–5° tilt for readable signs)

### 6.3 Storage layout

Uploaded gallery files are stored on the backend container's volume at `backend/uploads/gallery/<uuid>.<ext>` and served via Nginx as `/uploads/gallery/<file>`. This directory is excluded from git and persisted by Docker as the named volume `uploads_data`.

## 7. Gallery Module

`saved_places` rows belong to a `collection_name` (free-text string). The gallery UI groups saves by collection name on the fly — there is no separate `collections` table. This keeps the model simple and lets renames be a single SQL UPDATE.

Key behaviors:

- **Save flow** — `POST /gallery/saves` (multipart: image + metadata). The backend stores the image, parses EXIF, creates an `image_metadata` row, links it via FK, and creates the `saved_place` row. The `place_name` and coordinates can be the search-resolved values OR user-edited values from the result screen.
- **Collection rename** — `POST /gallery/collections/rename` bulk-updates `collection_name` for all saves under the old name.
- **Collection delete** — `DELETE /gallery/collections/{name}` deletes all saves in the collection. Single-photo deletion uses `DELETE /gallery/saves/{id}`.
- **Empty collection support** — Empty collection names created by the UI are kept in browser `localStorage` until the first save lands. This avoids adding a separate `collections` table just to track empty placeholders.
- **Photo move** — `PATCH /gallery/saves/{id}` with `collection_name` reassigns a photo. The viewer modal supports keyboard prev/next and ESC.

## 8. Journal Pipeline

The Journal feature converts a selection of gallery photos into a narrated travel diary. The pipeline runs as a background job.

### 8.1 Eligibility rule

A saved place is journal-eligible only if its linked `image_metadata.has_gps` is `True` — meaning the **original photo's EXIF carried real GPS coordinates**. Photos whose location was inferred only by the Search pipeline (fallback coordinates) are excluded so the journal map reflects the actual itinerary rather than guesses. The photo picker disables ineligible photos with a "no GPS" label.

Date is not required: a photo without `captured_at` is still eligible. The journal places undated entries in the order returned by the API.

### 8.2 Per-photo processing

For each selected `image_metadata_id`:

1. CLIP (ViT-B/32) runs locally and produces multi-label classifications for three axes: subject (e.g., beach, temple, food), atmosphere (e.g., crowded, peaceful, day, night), and activity (e.g., dining, hiking, sightseeing). Results are cached in `clip_cache`.
2. OpenAI Vision (gpt-4.1-mini) generates a short narrative entry conditioned on the CLIP labels and the resolved place name.
3. Structured outputs (CLIP arrays, GPT categorical fields, narrative text) are stored as one row in `journal_entries`.

### 8.3 Job model

`POST /journals/generate` returns `{ job_id, status }` immediately. The job runs in a FastAPI background task. The client polls `GET /journals/jobs/{job_id}` until status reaches `done` or `partial_success`. Partial success means at least one entry generated; failed photos are listed in the response.

### 8.4 Reading experience

`/journal/collections/{id}` renders a diary-style viewer: one entry per page with prev/next arrows and keyboard navigation, an editable title, and a "View on map" overlay with numbered pins connected by a dotted polyline. Hover tooltips on pins show place name and a journal text excerpt.

### 8.5 Stats and recommendations

The stats endpoint aggregates across all journals belonging to the user: countries visited, cities visited, photo count, total distance traveled (sum of great-circle distances between consecutive entries with coordinates), and three label distributions (subject / atmosphere / activity).

The recommendation endpoint sends the stats blob to GPT-4o and asks for exactly three new destinations the user has not visited, with stat-grounded reasoning. The frontend renders each recommendation with a representative Wikipedia thumbnail (Wikipedia summary API + search API fallback for fuzzy matches).

The stats view uses a five-tier gamified level system on four metrics (Countries, Cities, Photos, Distance) with thresholds calibrated to feel rewarding early and substantial at the top.

## 9. Live Chat — 13 Tag Lounges

### 9.1 Lounge model

The system uses **13 permanent tag-based lounges** rather than per-city or per-trip rooms. This prevents user fragmentation across hundreds of empty city rooms and lets users find conversation partners by shared travel interest.

Lounges are seeded on backend startup by `ensure_chat_rooms(db)`. The 13 tag keys live in `services/chat_tags.py`:

```text
Nature      : beach, mountain, nature, desert
Urban       : urban, historical, nightlife
Culture     : food, museum, market
Experience  : transport, sunset, snow
```

### 9.2 Search → Lounge bridge

After Search analysis, the backend maps the photo's Google Vision labels, GPT scene type, and Places types to one or more standard tag keys using a curated dictionary (`LABEL_TO_TAG`). The mapped tags are stored on `image_metadata.tags` and returned in the Search response as `chat_lounges`. The Search result UI renders a "Join Lounges" section linking to those rooms.

### 9.3 Real-time path

```text
Client                                      Backend
  │                                            │
  │ ws://.../api/ws/chat/{room_id}?token=JWT   │
  ├───────────────────────────────────────────►│
  │                                            │ Handshake:
  │                                            │  • decode JWT
  │                                            │  • register WebSocket in
  │                                            │    ConnectionManager[room_id]
  │                                            │  • broadcast presence to room
  │                                            │
  │       {"type":"send","text":"..."}         │
  ├───────────────────────────────────────────►│ Persist to chat_messages,
  │                                            │ broadcast {"type":"message",...}
  │       {"type":"message", ...} ◄────────────┤ to every socket in room
  │       {"type":"presence", "online":N} ◄────┤
  │       {"type":"delete", id} ◄──────────────┤
```

The `ConnectionManager` keeps a `dict[room_id, set[WebSocket]]`. Disconnects (manual close or socket exception) remove the socket and broadcast updated presence. A 30-second ping/pong heartbeat detects half-closed connections.

### 9.4 REST fallback

If a client cannot upgrade to WebSocket (corporate proxy, hostile mobile network), the same lounge is accessible via REST:

- `GET /chat-rooms/{room_id}/messages?limit=50` — load history
- `POST /chat-rooms/{room_id}/messages` — send

The frontend periodically polls the room and updates the status banner to "REST polling fallback". Messages still persist to the same `chat_messages` table.

### 9.5 Photo attachment

A message can carry `image_url` referencing a gallery photo owned by the sender. The send endpoint verifies that the URL maps to an `image_metadata` row whose `user_id` equals the sender — preventing leakage of unowned images.

## 10. Admin and Moderation

### 10.1 Admin endpoints

| Endpoint | Purpose |
|---|---|
| `GET /admin/summary` | Counts: total users, active users, disabled users, open moderation items, total chat messages |
| `GET /admin/users?q=` | List users with optional search (name / email / user ID) |
| `PATCH /admin/users/{user_id}` | Toggle role or activation status |
| `GET /admin/moderation` | List all moderation items, newest first |
| `POST /admin/moderation` | Admin-created moderation case |
| `PATCH /admin/moderation/{item_id}` | Resolve a moderation item |

### 10.2 Bug report path

Travelers submit bug reports through Settings. `POST /reports` creates a `moderation_items` row (`item_type="bug_report"`, reporter set from the JWT user). Reports surface in the admin moderation queue with the original reporter name, title, and reason. Admin resolves with a single PATCH.

### 10.3 Self-protection

Admins cannot disable their own account through `PATCH /admin/users/{self}`. This avoids the trivial lockout failure mode.

## 11. Deployment

### 11.1 Topology

```text
                 ┌─────────────────────────┐
Browser ◄───────►│ frontend (Nginx, port 80)│
                 │  • serves React static   │
                 │  • proxies /api/*  ──────┐
                 │  • proxies /uploads/* ──┐│
                 │  • upgrades WS /ws/*  ──┘│
                 └─────────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │ backend (FastAPI, 8000) │
                 │  • Uvicorn worker        │
                 │  • runs alembic upgrade  │
                 │    head on start         │
                 └─────────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │ db (Postgres 16, 5432)  │
                 │  • named volume          │
                 │    `postgres_data`       │
                 └─────────────────────────┘
```

`docker compose up --build` is the canonical way to start the full stack. Backend's `start.sh` runs `alembic upgrade head` before exec'ing Uvicorn, ensuring the schema is current on every container start.

### 11.2 Environment variables

All secrets live in `backend/.env`. Required keys: `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `JWT_SECRET`, `EMAIL_FROM`, `EMAIL_PASSWORD`. Tunables: `JWT_EXPIRE_MINUTES`, `OPENAI_VISION_MODEL`, `POSTGRES_*`. The `.env.example` documents every key with sane defaults; no key is hard-coded.

### 11.3 Local development without Docker

For fast backend hot reload, contributors can run `docker compose up -d db` for Postgres only and use `uvicorn app.main:app --reload --port 8000` directly with `.venv`. The frontend uses `npm run dev` (Vite at port 5173). This is the recommended developer loop.

## 12. Original Design vs Implementation

The initial Software Design Document included several modules that were descoped during implementation. The table below records what was deferred and why, so reviewers can compare the original plan to the shipped product without spelunking through commit history.

| Originally planned | Final implementation | Reason |
|---|---|---|
| Google OAuth login | JWT + email OTP registration only | OTP path is simpler, avoids OAuth consent verification for a class project, and keeps user data in our own database. |
| Google Directions API + "Open Guide" button (route to destination) | Removed | The product turned out to be about *recovering* past locations, not navigating to new ones. Route generation did not serve any concrete user story. |
| Upload rate limiting (e.g. 10/min) | Not enforced | A class project with a small user base did not justify the operational complexity of a rate-limit layer (Redis token bucket etc.). |
| Privacy toggle "Allow admin to view my images" | Replaced with general `privacy: private / unlisted / public` per saved place | The original toggle confused admin moderation with content sharing. The shipped model is the standard three-tier social privacy expected by users. |
| Burst-shot Observation Layer (≤10 s / ≤30 m grouping) | Not implemented | The test photo set lacked the second-precise EXIF timestamps needed to cluster reliable bursts. Per-photo journal entries proved sufficient for the diary-style reader. |
| Segment Layer with stay / transit / uncertain classification | Not implemented | Requires POI-based and document-based classifiers that have their own multi-API pipelines. Out of scope for the final release. |
| Document understanding (ticket / receipt / map screenshot) | Not implemented | Same scope reason. The shipped Journal does not differentiate document photos from scene photos. |
| Weather lookup in journal generation | Service exists (`weather_service.py`), but not wired into journal entries | Not enough lead time to wire it through schema + UI without risking the rest of the journal flow. Marked as future extension. |
| Food / restaurant-specific search pipeline | Not implemented | The general Search pipeline handles food photos as long as a logo or menu OCR triggers; a dedicated food pipeline was descoped to keep the main flow strong. |

These descoped items are listed honestly here rather than buried in commit history so the project can be evaluated against what it actually delivers.
