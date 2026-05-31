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
| POST | `/image` | Upload one image and run location analysis. Returns candidates, tags, and recommended chat lounges. |

## Gallery

| Method | Path | Purpose |
|---|---|---|
| GET | `/gallery` | List saved gallery items or groups. |
| POST | `/gallery` | Save a selected image/location result. |
| GET | `/gallery/{id}` | Read saved gallery detail. |
| PATCH | `/gallery/{id}` | Update gallery title or details. |
| DELETE | `/gallery/{id}` | Delete a saved gallery item or group. |

## Journal

| Method | Path | Purpose |
|---|---|---|
| POST | `/journals/generate` | Generate a journal draft from saved photos and location data. |
| POST | `/journals` | Save a final journal. |
| GET | `/journals` | List current user's journals. |
| GET | `/journals/{journal_id}` | Read one journal. |
| PATCH | `/journals/{journal_id}` | Update a journal. |
| DELETE | `/journals/{journal_id}` | Delete a journal. |

## Profile and Settings

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me` | Return current profile and setting summary. |
| PUT | `/profile` | Update first name, last name, email, and bio. |
| GET | `/settings` | Read current user's settings. |
| PATCH | `/settings` | Update display name, privacy, theme, and email preference. |

## Live Chat Tag Lounges

| Method | Path | Purpose |
|---|---|---|
| GET | `/chat-rooms` | List all 13 permanent tag lounges. |
| GET | `/chat-rooms/recommendations?tags=historical,urban` | Return recommended lounges from tags or image ID. |
| POST | `/chat-tags/normalize` | Convert raw analysis data into standard lounge tags. |
| GET | `/chat-rooms/{room_id}/messages?limit=50` | Load recent messages from a lounge. |
| POST | `/chat-rooms/{room_id}/messages` | Send a message through REST fallback. |
| WS | `/ws/chat/{room_id}?token=JWT` | Connect to live room messages through WebSocket. |

## Admin

Admin endpoints require a user with `role = admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/summary` | Dashboard summary. |
| GET | `/admin/users?q=` | Search and list users. |
| PATCH | `/admin/users/{user_id}` | Update user role or status. |
| GET | `/admin/moderation` | List moderation items. |
| POST | `/admin/moderation` | Create moderation item. |
| PATCH | `/admin/moderation/{item_id}` | Resolve or update moderation item. |
