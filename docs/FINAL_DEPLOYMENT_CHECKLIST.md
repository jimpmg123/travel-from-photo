# Final Deployment Checklist

Use this checklist before pushing the final release branch or presenting the final demo.

## 1. Environment

- [ ] Copy `.env.example` to `.env`.
- [ ] Replace `JWT_SECRET` with a long random value (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).
- [ ] Set `OPENAI_API_KEY` for Search Tier 2 / Tier 3 and Journal generation.
- [ ] Set `GOOGLE_MAPS_API_KEY` for Vision (Landmark / OCR / Logo / Web / Label), Geocoding, and Places.
- [ ] Set `EMAIL_FROM` and `EMAIL_PASSWORD` (Gmail App Password) for the registration OTP path.
- [ ] Confirm `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are consistent with `docker-compose.yml`.
- [ ] Confirm `JWT_EXPIRE_MINUTES` is set (`10080` for 7-day sessions in production).
- [ ] Do not commit `.env`, API keys, or uploaded runtime files.

## 2. Local Docker Run

```bash
cp .env.example .env
docker compose down -v
docker compose up --build
```

Expected URLs:

- Frontend: `http://localhost`
- Backend docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

## 3. Database and Seed Data

Run the demo seed once for testing:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

Test accounts:

- Admin: `jaemin@example.com` / `Travel2026!`
- Traveler: `mina@example.com` / `Travel2026!`

Confirm migration head:

```bash
docker compose exec backend alembic current
```

Expected final revision:

```text
d5e6f7a8b9c0
```

(`alembic current` should print this exact string after `alembic upgrade head` finishes inside the container's `start.sh`.)

Confirm the 13 chat lounges are seeded:

```bash
docker compose exec db psql -U travel_user -d travel_db -c "SELECT COUNT(*) FROM chat_rooms;"
# Expected: 13
```

## 4. Feature Smoke Test

### Auth
- [ ] Register a new account → OTP email arrives → activate → login.
- [ ] Login as seeded `mina@example.com` works.
- [ ] Login as seeded `jaemin@example.com` works and the Admin nav item appears.

### Search
- [ ] Single-photo upload returns ranked candidates with confidence scores within ~30 seconds.
- [ ] Multi-photo upload runs in parallel; weak photos receive a cluster-derived retry.
- [ ] Top match shows the diagnostic panel "How we got this result" with contributing signal sources.
- [ ] Top match place name is editable inline; the change persists after a re-search.
- [ ] "Pick on map" lets the user drop a new pin; the place name updates via `/geocode/reverse`.
- [ ] Search response includes a "Join Lounges" section linked to the 13-tag chat rooms.

### Gallery
- [ ] Save a single top match to Gallery; it appears with the candidate's city as the collection name.
- [ ] "Save all" stores every top match grouped by city in one call.
- [ ] Collection card supports rename and full-collection delete.
- [ ] Inside a collection, photos can be moved to another collection and deleted individually.
- [ ] Image viewer modal supports left/right arrows and keyboard navigation.

### Journal
- [ ] Create a journal from selected gallery photos.
- [ ] Only photos whose linked `image_metadata.has_gps = True` (real EXIF GPS) are selectable.
- [ ] Journal detail page renders one entry at a time (diary-style) with prev/next arrows and a dot indicator.
- [ ] Journal title is editable inline.
- [ ] Journal map view shows numbered pins connected by a dotted polyline; hover tooltip displays place name and journal text excerpt.
- [ ] Stats page shows 4 leveled progress bars (Countries / Cities / Photos / Distance) with Lv 1–5 badges.
- [ ] Recommendations panel renders representative photos (Wikipedia thumbnails) with country and reasoning.
- [ ] Journal can be deleted from both the collections card and the detail page.

### Live Chat
- [ ] Chat home lists all 13 tag lounges with online counts.
- [ ] WebSocket connects; status banner reads "WebSocket online".
- [ ] Send a text message; it appears in a second browser tab within ~1 second.
- [ ] Attach a gallery photo to a message; it renders inline.
- [ ] Refresh the page; message history persists.
- [ ] Click a "Join Lounges" link from Search results and confirm the matching lounge is preselected.

### Profile and Settings
- [ ] Profile loads the current user's data from `/api/users/me`.
- [ ] Update display name, bio, and email; changes persist after refresh.
- [ ] Change theme to Dark; the page background and panels turn dark immediately.

### Bug Report
- [ ] Settings → "Report a bug" form submits successfully.
- [ ] Reported item appears in the admin moderation queue with the original reporter's name.

### Admin
- [ ] Admin account can open the Admin Panel.
- [ ] Traveler account is redirected away from `/admin`.
- [ ] User table supports search, role toggle, and enable/disable.
- [ ] Disabling the caller's own account is refused with an explanatory error.
- [ ] Moderation queue lists bug reports; resolving an item updates the row's status.

## 5. Build Verification

Frontend production build:

```bash
cd frontend
npm install
npm run build
# Expect "✓ built in Xs" with no TypeScript errors.
```

Backend syntax check:

```bash
cd backend
python -m compileall -q app
# No output = no syntax errors.
```

End-to-end Docker build:

```bash
docker compose down -v
docker compose up --build
curl http://localhost/api/health   # {"status":"ok"}
```

## 6. Submission Readiness

- [ ] `README.md` setup / build / test / deploy instructions are up to date.
- [ ] `docs/API_DESIGN_FINAL.md` reflects the actual endpoint paths.
- [ ] `docs/system-architecture.md` reflects the actual implementation (and lists descoped items honestly in Section 12).
- [ ] Any known bugs are tracked in GitHub Issues (`docs/BUG_TRACKING.md` describes the process).
- [ ] Public deployment URL is reachable and included in the submission.
- [ ] Test account credentials (admin + traveler) are sent to the instructor by email.
- [ ] Presentation slides and demo script are prepared with verified sample photos.
