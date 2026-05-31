# Final Test Plan

## Test accounts

After running `python -m app.scripts.seed_complete`:

| Role | Email | Password |
|---|---|---|
| Admin | `jaemin@example.com` | `Travel2026!` |
| Traveler | `mina@example.com` | `Travel2026!` |

## Manual test cases

### Auth

1. Login with admin account.
2. Confirm Admin menu is visible.
3. Logout.
4. Login with traveler account.
5. Confirm Admin route redirects to Search.

### Search and Lounge Recommendation

1. Upload a travel image.
2. Confirm candidates appear.
3. Confirm tags appear.
4. Click Join Lounges.
5. Confirm Live Chat opens with recommended tags.

### Gallery

1. Save a selected Search result.
2. Open Gallery.
3. Confirm saved item appears.
4. Open item detail.

### Journal

1. Open Journal.
2. Select or use saved trip data.
3. Generate or save a draft.
4. Confirm the journal appears in collections.

### Profile and Settings

1. Open Profile.
2. Update profile fields.
3. Open Settings.
4. Change privacy or theme.
5. Refresh the page and confirm data stays saved.

### Live Chat

1. Open Live Chat.
2. Confirm all 13 lounges appear.
3. Select a lounge.
4. Send a message.
5. Refresh page and confirm message remains.
6. Check status shows WebSocket online or REST fallback.

### Admin

1. Login as admin.
2. Open Admin Panel.
3. Search users.
4. Update a user status or role.
5. Resolve a moderation item.

## Automated checks

Run frontend build:

```bash
cd frontend
npm install
npm run build
```

Run backend compile check:

```bash
cd backend
python -m compileall -q app
```

Run Docker deployment:

```bash
docker compose down -v
docker compose up --build
```
