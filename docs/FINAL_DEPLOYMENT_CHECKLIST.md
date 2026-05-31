# Final Deployment Checklist

Use this checklist before pushing the final release branch or presenting the beta release.

## 1. Environment

- [ ] Copy `.env.example` to `.env`.
- [ ] Replace `JWT_SECRET` with a long random value.
- [ ] Set `OPENAI_API_KEY` for Search and Journal AI features.
- [ ] Set Google/API keys only if the team is using those integrations.
- [ ] Confirm `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are consistent with `docker-compose.yml`.
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

Run this once for local testing:

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
e7b1c2d3a4f5
```

## 4. Feature Smoke Test

- [ ] Register/login flow works or seed login works.
- [ ] Search accepts an image and returns location candidates.
- [ ] Search results show tags and Join Lounges.
- [ ] Gallery can save and view a result.
- [ ] Journal can generate or display a draft from saved data.
- [ ] Profile loads current user data.
- [ ] Settings save privacy/theme preferences.
- [ ] Live Chat lists 13 tag lounges.
- [ ] Live Chat loads previous messages.
- [ ] Live Chat sends a message through WebSocket or REST fallback.
- [ ] Admin account can open Admin Panel.
- [ ] Traveler account cannot open Admin Panel.
- [ ] Admin can view users and moderation items.

## 5. Submission Readiness

- [ ] README has setup, build, test, and bug-report instructions.
- [ ] API documentation is updated.
- [ ] Schedule/progress update is added.
- [ ] GitHub Issues contains any known bugs.
- [ ] Serious bugs have assignees.
- [ ] Deployment link is included in the submission.
