# B Track Database Design

## 1. Overview

The B track uses PostgreSQL through SQLAlchemy models and Alembic migrations. It adds database support for user settings, tag-based chat rooms, chat messages, and moderation items.

The B track depends on the shared `users` table from the authentication system.

---

## 2. Tables Used by B Track

### 2.1 `users`

The `users` table is shared with the A track authentication system.

B track uses this table for:

- Profile identity
- Settings ownership
- Chat sender identity
- Admin role checks
- Active user checks

Important fields used by B track:

| Field | Purpose |
|---|---|
| `id` | Internal database user ID. |
| `user_id` | Public/user-facing identifier. |
| `email` | Login and contact email. |
| `first_name` | User first name. |
| `last_name` | User last name. |
| `role` | Used for admin authorization. |
| `is_active` | Used to block inactive accounts. |

---

### 2.2 `user_settings`

Stores user-specific account preferences.

| Field | Purpose |
|---|---|
| `id` | Primary key. |
| `user_id` | Foreign key to `users.id`. |
| `display_name` | Name shown in the app. |
| `default_privacy` | Default privacy setting, usually private. |
| `theme` | User appearance preference. |
| `email_notifications` | Whether email notifications are enabled. |
| `bio` | Optional user bio. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

Business rules:

- Each user should have at most one settings row.
- Settings belong only to the authenticated user.
- Default privacy should be private unless changed.

---

### 2.3 `chat_rooms`

Stores the 13 permanent tag-based Live Chat lounges.

| Field | Purpose |
|---|---|
| `id` | Primary key. |
| `tag_key` | Standard tag key, such as `food` or `historical`. |
| `display_name` | User-facing lounge name. |
| `emoji` | Lounge emoji. |
| `description` | Lounge description. |
| `category` | Lounge category. |
| `created_at` | Creation timestamp. |

Business rules:

- `tag_key` should be unique.
- All 13 rooms should exist after seed or initialization.
- Rooms should not be deleted during normal use.
- Rooms exist even if zero users are online.

---

### 2.4 `chat_messages`

Stores all Live Chat messages.

| Field | Purpose |
|---|---|
| `id` | Primary key. |
| `room_id` | Foreign key to `chat_rooms.id`. |
| `sender_user_id` | Foreign key to `users.id`. |
| `message_text` | Message body. |
| `image_id` | Optional foreign key to uploaded image metadata. |
| `created_at` | Message creation timestamp. |
| `read_at` | Optional read timestamp. |

Business rules:

- Messages are stored permanently in PostgreSQL.
- Messages remain visible after page refresh or re-login.
- When a user enters a room, the recent messages are loaded from this table.
- WebSocket messages and REST fallback messages both write to this table.

---

### 2.5 `moderation_items`

Stores admin moderation tasks.

| Field | Purpose |
|---|---|
| `id` | Primary key. |
| `item_type` | Type of item, such as Search result or Chat. |
| `title` | Short title of the moderation item. |
| `reporter_name` | Name of the reporter or source. |
| `reason` | Reason for moderation. |
| `status` | Current status, such as open or resolved. |
| `created_at` | Creation timestamp. |
| `resolved_at` | Resolution timestamp. |

Business rules:

- Only admins should view or update moderation items.
- Resolved items should keep their record for audit/history.

---

### 2.6 `image_metadata.tags`

The Search feature can store standard Live Chat tags in the image metadata table.

Example:

```json
["historical", "urban", "sunset"]
```

B track uses this field to recommend related Live Chat lounges after Search.

---

## 3. Relationships

```text
users 1 --- 1 user_settings
users 1 --- many chat_messages
chat_rooms 1 --- many chat_messages
image_metadata 1 --- many chat_messages optional attachment
users role/admin --- admin panel authorization
```

---

## 4. Persistence Rules

- Profile and settings changes must persist after refresh.
- Chat messages must persist after refresh, re-login, and room re-entry.
- Admin moderation items must remain until resolved or changed by an admin.
- Chat rooms are permanent system rows.

---

## 5. Migration Notes

The B track social features are expected to be included in Alembic migration files. The migration should create or update:

- `user_settings`
- `chat_rooms`
- `chat_messages`
- `moderation_items`
- `image_metadata.tags`

The expected final migration head in the current beta version is:

```text
e7b1c2d3a4f5
```
