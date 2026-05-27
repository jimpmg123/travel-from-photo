from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers.health import router as health_router
from app.routers.image import router as image_router
from app.routers.journal import router as journal_router
from app.routers.profile import router as profile_router
from app.routers.gallery import router as gallery_router
from app.routers.chat import router as chat_router
from app.routers.admin import router as admin_router
from app.core.config import get_cors_origins
from app.core.db import create_tables

APP_TITLE = "Travel From Photo API"
API_PREFIX = "/api"
FRONTEND_ORIGINS = get_cors_origins()


def add_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def register_routes(app: FastAPI) -> None:
    @app.get("/")
    def root():
        return {
            "message": "Travel From Photo API is running",
            "docs": "/docs",
            "health": "/api/health",
        }

    app.include_router(health_router, prefix=API_PREFIX)
    app.include_router(image_router, prefix=API_PREFIX)
    app.include_router(journal_router, prefix=API_PREFIX)
    app.include_router(profile_router, prefix=API_PREFIX)
    app.include_router(gallery_router, prefix=API_PREFIX)
    app.include_router(chat_router, prefix=API_PREFIX)
    app.include_router(admin_router, prefix=API_PREFIX)


def create_app() -> FastAPI:
    app = FastAPI(title=APP_TITLE)
    add_cors(app)
    register_routes(app)

    @app.on_event("startup")
    def initialize_database() -> None:
        create_tables()

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    return app


app = create_app()
