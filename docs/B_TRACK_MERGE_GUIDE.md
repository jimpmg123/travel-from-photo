# B Track Merge Guide

This file explains what was added for Jaemin's B track and how to merge it safely with the A track.

## B Track Scope

The B track covers the social and management side of the project:

- Profile and settings UI
- Live chat UI and API
- Admin panel UI and API
- User search
- Basic moderation queue
- Demo data reset for presentation
- Integration support for final demo

## Files Added or Changed

### Backend

- `backend/app/routers/profile.py`
- `backend/app/routers/chat.py`
- `backend/app/routers/admin.py`
- `backend/app/services/social_state.py`
- `backend/app/main.py`

### Frontend

- `frontend/src/app/pages/ProfilePage.tsx`
- `frontend/src/app/pages/SettingsPage.tsx`
- `frontend/src/app/pages/LiveChatPage.tsx`
- `frontend/src/app/pages/AdminPanelPage.tsx`
- `frontend/src/app/services/socialApi.ts`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/app/data.ts`
- `frontend/src/app/types.ts`

## API Endpoints Completed

### Profile and Settings

- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/users/me`
- `GET /api/settings`
- `PATCH /api/settings`

### Live Chat

- `GET /api/chat/messages`
- `POST /api/chat/messages`
- `PATCH /api/chat/messages/{message_id}/read`

### Admin

- `GET /api/admin/summary`
- `GET /api/admin/users`
- `PATCH /api/admin/users/{user_id}`
- `GET /api/admin/moderation`
- `PATCH /api/admin/moderation/{item_id}`
- `POST /api/admin/reset-demo-data`

## Important Merge Notes

`main.py`, `App.tsx`, and `App.css` are the most likely files to conflict with the A track. Resolve those carefully.

The B-track backend currently uses `backend/app/services/social_state.py`, which stores demo state in a small JSON file. This was done on purpose so the B track can run before the A-track database and authentication code is merged.

After the A track is merged, the ideal next step is to replace the JSON state helper with real SQLAlchemy repositories. The API contracts can stay the same.

## Admin Authorization Note

The admin API currently checks this request header:

```text
X-User-Role: admin
```

This is only a temporary demo guard. During final merge, replace it with the A-track token/session role check.

## Safe Merge Order

1. Merge backend B-track routers.
2. Register routers in `backend/app/main.py`.
3. Merge frontend B-track pages.
4. Merge `socialApi.ts`.
5. Add B pages to `App.tsx` routing/navigation.
6. Resolve CSS conflicts at the bottom of `App.css`.
7. Run backend and frontend build checks.

## Build Check Commands

Backend:

```bash
cd backend
python -m py_compile app/main.py app/routers/profile.py app/routers/chat.py app/routers/admin.py app/services/social_state.py
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```
