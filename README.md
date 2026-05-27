# Travel From Photo

Travel From Photo is a web application for recovering and organizing travel photo locations. This branch includes deployment-ready B-track work for profile/settings, live chat, and admin management.

## Run locally with Docker

```bash
cp .env.example .env
docker compose up --build
```

Seed the B-track database records:

```bash
docker compose exec backend python -m app.scripts.seed_social
```

Frontend:

```text
http://localhost
```

Backend API docs:

```text
http://localhost:8000/docs
```

## B-track deployment status

The B-track features are now backed by PostgreSQL instead of JSON demo data.

- Profile and settings: `users`, `user_settings`
- Live chat: `chat_messages`
- Admin moderation: `moderation_items`
- Admin user controls: real `users` table
- Docker deployment: frontend, backend, and database services

See `docs/B_TRACK_DEPLOYMENT_NOTES.md` for details and A/B merge notes.

## Database setup included

This version includes a real PostgreSQL schema under `db/`. The database is created automatically when the Docker PostgreSQL volume is first created.

```bash
cp .env.example .env
docker compose down -v
docker compose up --build
```

The main schema files are:

```text
db/init/001_schema.sql
db/init/002_seed.sql
docs/DB_SETUP.md
```

The schema includes `users`, `user_settings`, `gallery_groups`, `images`, `search_results`, `selected_locations`, `journals`, `chat_messages`, `moderation_items`, and `image_metadata`.

To inspect the tables after startup:

```bash
docker compose exec db psql -U travel_user -d travel_db -c "\dt"
```
