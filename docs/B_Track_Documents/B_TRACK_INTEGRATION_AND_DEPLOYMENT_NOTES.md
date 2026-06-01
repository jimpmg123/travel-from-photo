# B Track Integration and Deployment Notes

## 1. Purpose

This document explains how the B track features connect to the full Travel From Photo project during merge, testing, and deployment.

The B track should not be deployed as a separate app. It must be integrated with the A track authentication, database, and deployment structure.

---

## 2. B Track Dependencies

The B track depends on:

- JWT authentication
- Shared `users` table
- PostgreSQL database
- Alembic migrations
- Frontend route handling
- Backend API prefix `/api`
- Search tags for Live Chat recommendations

If any of these shared systems fail, B track features may not work correctly.

---

## 3. Authentication Requirements

Profile, Settings, and Live Chat require a logged-in user.

Admin requires a logged-in user with:

```text
role = admin
```

Live Chat is not admin-only. It should work for both admin and traveler users.

Expected behavior:

```text
admin user -> can use Live Chat and Admin Panel
traveler user -> can use Live Chat, cannot use Admin Panel
not logged in -> cannot use Live Chat or Admin Panel
```

---

## 4. Token Storage and Debugging

Frontend login should store a JWT token in local storage.

Expected key:

```text
tfp_token
```

To check in browser console:

```javascript
localStorage.getItem("tfp_token")
```

If this returns `null`, authenticated APIs such as Live Chat will fail.

REST API requests should include:

```text
Authorization: Bearer <token>
```

WebSocket connection should include token in the URL:

```text
/api/ws/chat/{room_id}?token=<token>
```

---

## 5. Environment Variables

The following values should be set in `.env` before deployment:

```env
OPENAI_API_KEY=real_openai_api_key
JWT_SECRET=long_random_secret
POSTGRES_DB=travel_db
POSTGRES_USER=travel_user
POSTGRES_PASSWORD=strong_password
```

OpenAI API is required for Search and AI-related Journal features. Profile, Settings, Admin, and Live Chat should work without OpenAI API, as long as authentication and database are working.

---

## 6. Local Docker Run

From the project root:

```bash
cp .env.example .env
docker compose down -v
docker compose up --build
```

Then seed test users:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

Open:

```text
http://localhost
```

---

## 7. B Track Smoke Test After Deployment

Use these steps after deployment:

1. Login as admin: `jaemin@example.com / Travel2026!`.
2. Open Admin Panel.
3. Confirm admin data loads.
4. Logout.
5. Login as traveler: `mina@example.com / Travel2026!`.
6. Confirm traveler cannot access Admin Panel.
7. Open Profile and update data.
8. Open Settings and update preferences.
9. Open Live Chat.
10. Enter a lounge.
11. Send a message.
12. Refresh page.
13. Confirm the message remains.
14. Check `chat_messages` table in database.

Database check:

```bash
docker compose exec db psql -U travel_user -d travel_db -c "SELECT id, room_id, sender_user_id, message_text, created_at FROM chat_messages ORDER BY created_at DESC LIMIT 20;"
```

---

## 8. Common Issues

### Issue: Live Chat says user is not authenticated even after login

Possible causes:

- `tfp_token` is missing in local storage.
- `/api/chat-rooms` request does not include Authorization header.
- WebSocket URL does not include `token=`.
- JWT secret differs between backend containers or deployment environments.
- User is inactive in the database.

### Issue: Admin cannot open Admin Panel

Possible causes:

- User role is not `admin`.
- JWT is missing or expired.
- Backend admin route is not registered.
- Frontend is calling the wrong backend URL.

### Issue: Chat messages disappear after refresh

Possible causes:

- Messages are not being saved to `chat_messages`.
- Frontend is loading the wrong room.
- Database volume was reset with `docker compose down -v`.
- Backend is using a different database than expected.

---

## 9. Deployment Notes

For public deployment, use the same flow as local Docker deployment but set real environment values.

Recommended server deployment flow:

```bash
git clone <repo-url>
cd travel-from-photo
cp .env.example .env
nano .env
docker compose up --build -d
docker compose exec backend python -m app.scripts.seed_complete
```

Then test the public URL.

---

## 10. Beta Status

The B track passed local beta testing for:

- Admin login
- Admin Panel access
- Traveler blocked from Admin Panel
- Profile update
- Settings update
- Live Chat lounge entry
- Live Chat message sending
- Chat message persistence after refresh
- Direct database confirmation in `chat_messages`

Remaining tasks are mainly public deployment testing, mobile UI polish, and broader Search to Tags to Live Chat testing.
