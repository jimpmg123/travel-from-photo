# Database Setup Guide

This version includes a PostgreSQL database setup for deployment-style local testing.

## What was added

A new `db/` folder was added to the project root.

```text
db/
├── init/
│   ├── 001_schema.sql
│   └── 002_seed.sql
├── schema.sql
├── seed.sql
├── README.md
└── scripts/
    └── reset-local-db.sh
```

The root `docker-compose.yml` now mounts the database init folder into the PostgreSQL container.

```yaml
./db/init:/docker-entrypoint-initdb.d:ro
```

## Included tables

The schema includes the full project-level data model needed for Search, Gallery, Journal, Profile, Settings, Live Chat, Admin, and metadata storage.

```text
users
user_settings
gallery_groups
images
search_results
selected_locations
journals
chat_messages
moderation_items
image_metadata
```

## Run from a clean database

From the project root:

```bash
cp .env.example .env
docker compose down -v
docker compose up --build
```

The `down -v` step deletes the old local database volume. Use it only when you are okay losing local test data.

## Check the database

After the containers are running:

```bash
docker compose exec db psql -U travel_user -d travel_db -c "\dt"
```

Check B-track records:

```bash
docker compose exec db psql -U travel_user -d travel_db -c "SELECT id, email, role, is_active FROM users;"
docker compose exec db psql -U travel_user -d travel_db -c "SELECT id, room_id, message_text FROM chat_messages;"
docker compose exec db psql -U travel_user -d travel_db -c "SELECT id, title, status FROM moderation_items;"
```

## A/B merge note

If A already creates `users` through Auth, keep A's Auth logic as the source of truth. This DB schema already has the columns B needs:

```text
users.id
users.email
users.role
users.is_active
```

B-track tables reference `users.id`, so the safest merge plan is to keep one shared `users` table and let B tables connect to it.
