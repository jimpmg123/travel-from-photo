# B Track Deployment Notes

This version removes the JSON demo store used by the earlier B-track prototype and makes the B-track features database-backed.

## Completed B-track deployment work

- Profile and settings are stored in PostgreSQL through `users` and `user_settings`.
- Live chat messages are stored in PostgreSQL through `chat_messages`.
- Admin user search, status update, and role update use the real `users` table.
- Admin moderation queue uses the `moderation_items` table.
- B-track routers now use database sessions instead of local JSON state.
- Dockerfiles were added for backend and frontend.
- `docker-compose.yml` now runs PostgreSQL, FastAPI backend, and Nginx-served React frontend.
- Frontend API calls send the current user context through `X-User-*` headers until the A-track auth branch is merged.

## Important auth note

The B track does not own the final authentication system. For deployment before the A-track merge, the B endpoints use `X-User-Id`, `X-User-Email`, and `X-User-Name` headers to identify the current user. The database is still the source of truth for admin permission. Admin APIs check the user's role in the `users` table.

After the A-track auth branch is merged, replace `backend/app/services/auth_context.py` with JWT/session verification. The router API contracts can stay the same.

## How to run with Docker

From the project root:

```bash
cp .env.example .env
# edit .env and set strong POSTGRES_PASSWORD and API keys

docker compose up --build
```

Then seed B-track data once:

```bash
docker compose exec backend python -m app.scripts.seed_social
```

Open the frontend:

```text
http://localhost
```

Open backend docs:

```text
http://localhost:8000/docs
```

## B-track API endpoints

Profile and settings:

```text
GET    /api/users/me
GET    /api/profile
PUT    /api/profile
GET    /api/settings
PATCH  /api/settings
```

Live chat:

```text
GET    /api/chat/messages
POST   /api/chat/messages
PATCH  /api/chat/messages/{message_id}/read
```

Admin:

```text
GET    /api/admin/summary
GET    /api/admin/users
PATCH  /api/admin/users/{user_id}
GET    /api/admin/moderation
POST   /api/admin/moderation
PATCH  /api/admin/moderation/{item_id}
```

## Merge guidance for A track

Likely conflict files:

```text
backend/app/main.py
backend/app/models/__init__.py
frontend/src/App.tsx
frontend/src/app/services/socialApi.ts
frontend/src/app/pages/AdminPanelPage.tsx
frontend/src/app/pages/LiveChatPage.tsx
```

Safe additions from this branch:

```text
backend/app/models/social.py
backend/app/services/auth_context.py
backend/app/scripts/seed_social.py
backend/Dockerfile
frontend/Dockerfile
frontend/nginx.conf
docs/B_TRACK_DEPLOYMENT_NOTES.md
```
