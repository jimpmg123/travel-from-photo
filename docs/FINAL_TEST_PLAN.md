# Final Test Plan

## Test accounts

After running `python -m app.scripts.seed_complete`:

| Role | Email | Password |
|---|---|---|
| Admin | `jaemin@example.com` | `Travel2026!` |
| Traveler | `mina@example.com` | `Travel2026!` |

## Manual test cases

### Auth

1. Login with the admin account.
2. Confirm the Admin menu item is visible in the top navigation.
3. Logout.
4. Login with the traveler account.
5. Confirm the Admin menu item is hidden and `/admin` redirects to the home page.

### Search and Lounge Recommendation

1. Upload a single travel image with no hint.
2. Confirm ranked candidates appear within ~30 seconds.
3. Confirm the diagnostic panel "How we got this result" lists at least one contributing signal source (e.g., Web Image Search, Landmark Detection).
4. Confirm the top match shows standard travel tags (e.g., historical, urban, sunset).
5. Confirm the "Join Lounges" section lists at least one tag-matching lounge.
6. Click a Join Lounges link.
7. Confirm Live Chat opens with the matching lounge preselected.
8. Repeat with a multi-photo upload (3–5 photos from the same trip).
9. Confirm weak photos receive borrowed location context from confident photos (verdict band changes or the top candidate moves closer to the cluster).

### Search — User editing

1. Click the pencil icon next to the top match place name and rename it.
2. Toggle "Pick on map", click a new coordinate on the map, and confirm the place name and address update automatically via reverse-geocoding.
3. Click "Re-search this photo" on a non-confident result, add a hint, and confirm only that photo re-runs.

### Gallery

1. From a Search result, save the top match to Gallery.
2. Open Gallery; confirm the saved item appears in a collection named after the resolved city (or under "My Gallery" when no city was resolved).
3. Use the "Save all" button on a multi-photo Search and confirm every top match is saved, grouped by city.
4. Inside a collection, confirm the collection name can be renamed inline.
5. Move a single photo to a different collection using the "Move" action.
6. Delete a single photo from a collection.
7. Click the cover image to open the full-screen viewer; navigate with left/right arrows and close with ESC.
8. Delete an entire collection from the collection card (×) and from the detail page (Delete button).
9. Create an empty collection from the gallery page; confirm it disappears once the first save lands.

### Journal

1. Open Journal → Create Journal.
2. Pick a collection. Confirm photos whose original EXIF carried no GPS are visibly disabled with a "no GPS" label.
3. Select 2–5 eligible photos and start generation.
4. Wait for the generation job to finish; confirm the journal opens automatically or appears in Collections.
5. Open the saved journal. Confirm the diary-style viewer shows one entry at a time with prev/next arrows and dot indicator.
6. Rename the journal title inline; confirm it persists after refresh.
7. Open the "View on map" overlay. Confirm numbered pins are connected by a dotted polyline and hover tooltips display the place name with a journal text excerpt.
8. Open the Stats tab. Confirm 4 leveled progress bars (Countries / Cities / Photos / Distance) render with a Lv 1–5 badge each.
9. Open the Pie chart tab. Switch between subject / atmosphere / activity axes.
10. Open the Recommendations tab. Confirm 3 recommendation cards render with representative photos.
11. Delete the journal from the detail page and confirm it disappears from Collections.

### Profile and Settings

1. Open Profile. Confirm the current user's data is loaded.
2. Update display name, bio, and email; confirm the changes persist after a page refresh.
3. Open Settings. Change the theme to Dark; confirm the page background and panels turn dark immediately.
4. Change the default privacy level and confirm new gallery saves adopt the new value.

### Live Chat

1. Open Live Chat. Confirm all 13 lounges appear with online counts.
2. Select a lounge.
3. Send a text message.
4. Attach a gallery photo to a message; confirm it renders inline.
5. Open the same lounge in a second browser tab; confirm new messages appear in real time without manual refresh.
6. Refresh the page; confirm message history persists.
7. Confirm the connection status banner reads "WebSocket online".
8. Open the Search → Join Lounges flow again and confirm the matching lounge is preselected.

### Bug Report

1. Open Settings.
2. Open the "Report a bug" form.
3. Submit a report with a title, area, and description.
4. Confirm a success message appears.
5. Log in as admin and confirm the report appears in the moderation queue with the original reporter's name.
6. Resolve the report and confirm the row's status updates.

### Admin

1. Login as admin.
2. Open the Admin Panel.
3. Search for the seeded traveler user.
4. Toggle the user's role to admin and back to traveler.
5. Disable the seeded traveler's account; confirm the row shows status "disabled".
6. Attempt to disable the admin's own account; confirm the request is refused with an explanatory error.
7. Resolve a moderation item from the queue.

## Automated checks

### Frontend build

```bash
cd frontend
npm install
npm run build
# Expect "✓ built in Xs" with no TypeScript errors.
```

### Backend syntax compile

```bash
cd backend
python -m compileall -q app
# No output = no syntax errors.
```

### Docker end-to-end

```bash
docker compose down -v
docker compose up --build
curl http://localhost/api/health   # {"status":"ok"}
```

### Migration head

```bash
docker compose exec backend alembic current
# Expected: d5e6f7a8b9c0
```

### Chat lounge seed

```bash
docker compose exec db psql -U travel_user -d travel_db -c "SELECT COUNT(*) FROM chat_rooms;"
# Expected: 13
```
