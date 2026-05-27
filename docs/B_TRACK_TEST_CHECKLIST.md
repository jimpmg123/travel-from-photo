# B Track Test Checklist

Use this checklist before the final merge and presentation.

## Backend API

- [ ] `GET /api/users/me` returns the current demo user.
- [ ] `PUT /api/profile` updates profile fields.
- [ ] `GET /api/settings` returns display name, privacy, theme, and email notification setting.
- [ ] `PATCH /api/settings` saves setting changes.
- [ ] `GET /api/chat/messages` returns messages in time order.
- [ ] `POST /api/chat/messages` saves a new message.
- [ ] `GET /api/admin/summary` returns summary counts.
- [ ] `GET /api/admin/users` returns users.
- [ ] `GET /api/admin/users?q=mina` filters users.
- [ ] `PATCH /api/admin/users/{user_id}` updates role or status.
- [ ] `GET /api/admin/moderation` returns moderation items.
- [ ] `PATCH /api/admin/moderation/{item_id}` marks an item resolved.
- [ ] `POST /api/admin/reset-demo-data` resets the demo state.

## Frontend UI

- [ ] Profile page loads without crashing.
- [ ] Profile edit form saves.
- [ ] Settings page loads and saves.
- [ ] Live Chat page shows messages.
- [ ] Live Chat can send a new message.
- [ ] Admin Panel loads summary cards.
- [ ] Admin Panel can search users.
- [ ] Admin Panel can activate or disable a user.
- [ ] Admin Panel can resolve a moderation item.
- [ ] Navigation links open Profile, Settings, Live Chat, and Admin.

## Merge Checks

- [ ] `backend/app/main.py` still registers all A-track and B-track routers.
- [ ] `frontend/src/App.tsx` still includes all final pages.
- [ ] `frontend/src/App.css` has no duplicate broken CSS blocks.
- [ ] `npm run build` succeeds.
- [ ] Backend imports compile.
