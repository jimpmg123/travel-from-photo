# Travel From Photo Database

This folder contains the PostgreSQL database setup for local and deployment testing.

## Files

- `init/001_schema.sql` creates all core tables.
- `init/002_seed.sql` inserts safe sample records for local testing.
- `schema.sql` is a copy of the current schema for review.
- `seed.sql` is a copy of the current seed data for review.
- `scripts/reset-local-db.sh` removes the local Docker database volume and recreates it.

## Tables included

Core project tables:

- `users`
- `user_settings`
- `gallery_groups`
- `images`
- `search_results`
- `selected_locations`
- `journals`
- `chat_messages`
- `moderation_items`
- `image_metadata`

B-track tables:

- `user_settings`
- `chat_messages`
- `moderation_items`

## How it runs

The root `docker-compose.yml` mounts this folder into the PostgreSQL container:

```yaml
./db/init:/docker-entrypoint-initdb.d:ro
```

When the database volume is created for the first time, PostgreSQL runs the SQL files in order.

## Fresh local reset

Use this only when you want to delete the local database and recreate it:

```bash
./db/scripts/reset-local-db.sh
```

Then start the full app:

```bash
docker compose up --build
```

## Important note

PostgreSQL init scripts only run when the database volume is empty. If you already started the database before adding or changing these SQL files, run:

```bash
docker compose down -v
docker compose up --build
```
