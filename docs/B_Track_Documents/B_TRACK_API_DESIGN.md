# B Track API Design

## 1. Base URL

Local Docker deployment:

```text
http://localhost/api
```

Direct backend development:

```text
http://localhost:8000/api
```

Most B track endpoints require:

```text
Authorization: Bearer <JWT>
```

Admin endpoints require the authenticated user to have:

```text
role = admin
```

---

## 2. Profile and Settings APIs

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/users/me` | Return current user profile and settings summary. | Logged-in user |
| PUT | `/profile` | Update current user's profile fields. | Logged-in user |
| GET | `/settings` | Read current user's settings. | Logged-in user |
| PATCH | `/settings` | Update display name, privacy, theme, and notification settings. | Logged-in user |

### Profile Update Behavior

The profile update endpoint should only update the authenticated user's own profile. It should not allow a user to modify another user's account.

### Settings Update Behavior

If a user does not already have a settings row, the backend may create a default settings row before applying updates.

---

## 3. Live Chat APIs

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/chat-rooms` | List all 13 permanent tag lounges. | Logged-in user |
| GET | `/chat-rooms/recommendations?tags=historical,urban` | Return recommended lounges based on tags or image ID. | Logged-in user |
| POST | `/chat-tags/normalize` | Convert raw analysis payload into standard lounge tags. | Logged-in user |
| GET | `/chat-rooms/{room_id}/messages?limit=50` | Load recent messages from a lounge. | Logged-in user |
| POST | `/chat-rooms/{room_id}/messages` | Send a message through REST fallback. | Logged-in user |
| WS | `/ws/chat/{room_id}?token=JWT` | Connect to a lounge through WebSocket. | Logged-in user |

### Legacy Chat APIs

The following legacy endpoints remain available for compatibility:

| Method | Path | Purpose |
|---|---|---|
| GET | `/chat/messages?roomId=urban` | Load messages by tag key. |
| POST | `/chat/messages?roomId=urban` | Send a message by tag key. |

---

## 4. Live Chat Request and Response Notes

### Send Message Request

```json
{
  "messageText": "Does this location look like Prague?",
  "imageId": 12
}
```

`imageId` is optional. If it is provided, the backend should confirm that the image belongs to the current user.

### Message Response

```json
{
  "id": "15",
  "roomId": 2,
  "roomTag": "historical",
  "senderId": "jaemin001",
  "senderName": "Jaemin Jeon",
  "messageText": "Does this location look like Prague?",
  "imageId": 12,
  "createdAt": "2026-05-30T10:24:00Z",
  "readAt": null
}
```

### WebSocket Behavior

The WebSocket URL must include a JWT token because browser WebSocket connections cannot reliably send custom Authorization headers.

```text
/ws/chat/{room_id}?token=JWT
```

Expected WebSocket message payload:

```json
{
  "messageText": "This looks like an old town area.",
  "imageId": null
}
```

The backend stores the message in PostgreSQL and broadcasts it to users connected to the same room.

---

## 5. Admin APIs

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/admin/summary` | Return dashboard counts and summary data. | Admin only |
| GET | `/admin/users?q=` | Search and list users. | Admin only |
| PATCH | `/admin/users/{user_id}` | Update user role or active status. | Admin only |
| GET | `/admin/moderation` | List moderation items. | Admin only |
| POST | `/admin/moderation` | Create a moderation item. | Admin only |
| PATCH | `/admin/moderation/{item_id}` | Resolve or update a moderation item. | Admin only |

### Admin Authorization Rule

A request should be rejected if:

- No JWT is provided.
- The JWT is invalid.
- The user is inactive.
- The user role is not `admin`.

---

## 6. Error Handling Expectations

| Case | Expected Behavior |
|---|---|
| No token | Return 401 Unauthorized or show login-required state. |
| Invalid token | Return 401 Unauthorized. |
| Traveler accesses admin API | Return 403 Forbidden. |
| Chat room does not exist | Return 404 Not Found. |
| Empty chat message | Return 400 Bad Request. |
| Attached image does not belong to user | Return 403 Forbidden. |

---

## 7. Beta Test Accounts

After running the seed script:

| Role | Email | Password |
|---|---|---|
| Admin | `jaemin@example.com` | `Travel2026!` |
| Traveler | `mina@example.com` | `Travel2026!` |
