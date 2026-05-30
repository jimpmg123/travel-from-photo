# Travel From Photo

Travel From Photo is an AI-powered web application that helps users recover likely locations from travel photos, infer restaurant candidates from food images, and generate routes to those places.

## Team Members

- Jinu Hong - Frontend, Backend Developer
- Younghak Yoo - AI / Computer Vision Engineer

## Problem Statement

Travelers often lose location information after photos are shared or moved between devices. Existing image-based tools also struggle when a photo contains food, indoor scenes, or visually generic places, making it difficult to recover where the photo was taken.

## Solution Overview

Our system allows users to upload travel photos, upload food photos, or enter a destination manually. The backend combines metadata extraction, landmark detection, semantic image analysis, and user-provided context to infer a likely place or restaurant candidate, then presents the result on a map and supports route guidance.

## Additional Documentation

### How to Run Locally

If you want to view the website locally, there are a few setup steps in addition to opening it in a browser.

#### Prerequisites

- Node.js
- Python 3.10+
- Docker

#### 1. Start the database

From the repository root:

```bash
docker compose up -d
```

#### 2. Configure backend environment variables

Create `backend/.env` based on `backend/.env.example` and fill in the required values.

Required/used variables include:

- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_CLOUD_VISION_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `VISUAL_CROSSING_API_KEY`
- `DATABASE_URL`

#### 3. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 4. Run the frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

#### 5. Open the application

- Frontend: `http://localhost:5173`
- Backend API docs: `http://localhost:8000/docs`

#### Notes

- Some features depend on external APIs and may not work unless the corresponding API keys are configured.
- Uploaded files are served from the backend `uploads/` directory.

- [Project Details](docs/project-details.md)
- [System Architecture](docs/system-architecture.md)
- [API Overview](docs/api-overview.md)
- [API Details](docs/api-details.md)
- [Errors and Fallbacks](docs/errors-and-fallbacks.md)

## Complete Deployment Notes

This merged version includes A track and B track features together.

Deployment entry point:

```bash
cp .env.example .env
docker compose up --build
```

The backend applies Alembic migrations on startup. The B track social tables are managed by `backend/alembic/versions/e7b1c2d3a4f5_add_social_b_track.py`.

For local test accounts:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

See `docs/COMPLETE_DEPLOYMENT_GUIDE.md` for details.
