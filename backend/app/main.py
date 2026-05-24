from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.routers.gallery import router as gallery_router
from app.routers.image import router as image_router
from app.routers.journal import router as journal_router
from app.routers.profile import router as profile_router

APP_TITLE = "Travel From Photo API"
API_PREFIX = "/api"
FRONTEND_ORIGINS = [
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


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
        }

    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(image_router, prefix=API_PREFIX)
    app.include_router(journal_router, prefix=API_PREFIX)
    app.include_router(profile_router, prefix=API_PREFIX)
    app.include_router(gallery_router, prefix=API_PREFIX)


def create_app() -> FastAPI:
    app = FastAPI(title=APP_TITLE)
    add_cors(app)
    register_routes(app)

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    return app


app = create_app()
