# Final API Design

Base URL for local Docker deployment:

```text
http://localhost/api
```

Direct backend development URL:

```text
http://localhost:8000/api
```

Most protected endpoints require:

```text
Authorization: Bearer <JWT>
```

## Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create a new user and send verification OTP. |
| POST | `/auth/verify-otp` | Verify email OTP and activate account. |
| POST | `/auth/login` | Login and return JWT plus user info. |
| GET | `/auth/me` | Return current authenticated user. |

## Search

| Method | Path | Purpose |
|---|---|---|
| POST | `/image` | Upload one image and run the multi-tier location analysis. Returns ranked candidates, contributing signal sources, verdict, tier_reached, standard tags, and recommended chat lounges. Multipart fields: `file` (required), `country_hint`, `city_hint`, `user_hint`, `force_openai_retry`. |

## Gallery

| Method | Path | Purpose |
|---|---|---|
| GET | `/gallery/collections` | List all saved places for the current user, grouped by collection name. Each entry includes the linked `image_metadata.has_gps` so the Journal picker can mark eligibility correctly. |
| POST | `/gallery/saves` | Save a location result to gallery. Multipart: `image` (required file) + form fields (`place_name`, `collection_name`, `formatted_address`, `country`, `city`, `latitude`, `longitude`). The backend parses EXIF, creates a linked `image_metadata` row, and writes the `saved_places` row in one transaction. |
| PATCH | `/gallery/saves/{save_id}` | Update a single saved place. JSON body may include `place_name`, `collection_name` (used to move between collections), `latitude`, `longitude`, `formatted_address`. |
| DELETE | `/gallery/saves/{save_id}` | Delete a single saved place. |
| POST | `/gallery/collections/rename` | Rename a collection in bulk. JSON: `{ "old_name": "...", "new_name": "..." }`. |
| DELETE | `/gallery/collections/{collection_name}` | Delete every saved place under the collection. URL-encode names with spaces. |

## Journal

| Method | Path | Purpose |
|---|---|---|
| POST | `/journals/generate` | Kick off a background journal generation job. JSON body: `{ "image_ids": [int], "title": "..." }`. Returns `{ job_id, status }`. |
| GET | `/journals/jobs/{job_id}` | Poll job status. Returns progress, entries created, skipped image IDs, and error reason on failure. |
| GET | `/journals` | List the current user's saved journals (compact rows for the collections grid). |
| GET | `/journals/{journal_id}` | Read one journal with all entries in display order. |
| PATCH | `/journals/{journal_id}` | Edit the journal title and/or individual entry narrative text. |
| DELETE | `/journals/{journal_id}` | Delete a journal (cascades to entries). |
| GET | `/journals/stats` | Aggregated travel statistics: country count, city count, photo count, total_distance_km, and three label distributions (subject / atmosphere / activity). |
| GET | `/journals/recommendations` | AI-generated next-destination recommendations. Returns three items with name, country, and reasoning grounded in the user's stats. |

## Profile and Settings

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me` | Return the current user's full profile, including settings (display name, privacy default, theme, email notifications, bio). |
| GET | `/profile` | Same payload as `/users/me`. |
| PUT | `/profile` | Update first name, last name, email, and bio. |
| GET | `/settings` | Read display name, default privacy, theme, and email-notification preference. |
| PATCH | `/settings` | Update any settings field. |

## Live Chat Tag Lounges

| Method | Path | Purpose |
|---|---|---|
| GET | `/chat-rooms` | List all 13 permanent tag lounges with `online_count` and `last_message_at`. |
| GET | `/chat-rooms/recommendations?tags=historical,urban,sunset` | Return lounges matching the provided comma-separated tags. Used by the Search results page to drive the "Join Lounges" section. |
| POST | `/chat-tags/normalize` | Convert raw Vision / GPT analysis output into the 13 standard lounge tag keys. JSON body accepts `vision_labels`, `gpt_scene_type`, `places_types`. |
| GET | `/chat-rooms/{room_id}/messages?limit=50` | Load the most recent messages in a lounge (chronological). |
| POST | `/chat-rooms/{room_id}/messages` | Send a message via REST. Body accepts `message_text` and optional `image_url` referencing a gallery photo owned by the sender. Used as a fallback when WebSocket is unavailable. |
| WS | `/ws/chat/{room_id}?token=JWT` | WebSocket connection for real-time chat. Server pushes `{type:"message"}`, `{type:"presence", online}`, and `{type:"delete"}` events. Client sends `{type:"send", text, image_url?}`. |

Legacy single-room endpoints from the earlier B-track milestone are kept for backward compatibility:

| Method | Path | Purpose |
|---|---|---|
| GET | `/chat/messages?roomId=support` | Legacy: list messages in a single string-keyed room. |
| POST | `/chat/messages` | Legacy: send a message into a single string-keyed room. |
| PATCH | `/chat/messages/{message_id}/read` | Legacy: mark a message read. |

## Geocoding

| Method | Path | Purpose |
|---|---|---|
| GET | `/geocode/reverse?lat=&lng=` | Reverse-geocode coordinates to a structured response (`place_name`, `formatted_address`, `city`, `country`, normalized `latitude`/`longitude`). Used by the Search result map when the user drags the pin to a new location. |

## Reports

| Method | Path | Purpose |
|---|---|---|
| POST | `/reports` | Submit a bug report. JSON body: `{ "title": "...", "description": "...", "area": "search\|gallery\|journal\|chat\|admin\|other" }`. The handler creates a `moderation_items` row with `item_type="bug_report"` and the reporter set from the JWT user. The item appears in the admin moderation queue. |

## Admin

Admin endpoints require a user whose JWT contains `role: "admin"`. The `require_admin` dependency rejects any other caller with HTTP 403, even if the JWT itself is valid.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/summary` | Dashboard counts: total users, active users, disabled users, open moderation items, total chat messages. |
| GET | `/admin/users?q=` | List users with optional case-insensitive search across first name, last name, email, and user_id. |
| PATCH | `/admin/users/{user_id}` | Update role (`traveler` ↔ `admin`) or status (`active` ↔ `disabled`). The handler refuses to disable the caller's own account to prevent self-lockout. |
| GET | `/admin/moderation` | List all moderation items (bug reports + admin-created cases), newest first. |
| POST | `/admin/moderation` | Create a moderation case manually. |
| PATCH | `/admin/moderation/{item_id}` | Resolve a moderation item; sets `status="resolved"` and `resolved_at=now`. |

## Standard error responses

All endpoints follow FastAPI's default error envelope:

```json
{ "detail": "<human-readable message>" }
```

Common status codes:

| Code | Meaning |
|---|---|
| 400 | Validation failed (Pydantic) or business rule violated (e.g., empty message text). |
| 401 | Missing or invalid JWT. The frontend treats this as "session expired" and clears local auth state. |
| 403 | Authenticated but lacking required role (admin endpoints) or attempting to access another user's resource. |
| 404 | Resource not found or not owned by the current user. |
| 502 | External API (Google Vision, Geocoding, OpenAI) returned an error or timed out at the tier level. |
