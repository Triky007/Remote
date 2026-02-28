"""
Remote PDF Review — Backend
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uvicorn

from config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Remote PDF Review",
        description="Sistema de revisión remota de artes finales PDF",
        version="1.0.0"
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Ensure directories exist
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    os.makedirs(settings.UPLOADS_DIR, exist_ok=True)

    # Routes
    from routes.auth import router as auth_router
    from routes.users import router as users_router
    from routes.projects import router as projects_router
    from routes.machines import router as machines_router
    from routes.clients import router as clients_router
    from routes.process_catalog import router as process_catalog_router

    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(projects_router)
    app.include_router(machines_router)
    app.include_router(clients_router)
    app.include_router(process_catalog_router)

    # Static files for uploads (optional, for serving PDFs)
    if os.path.exists(settings.UPLOADS_DIR):
        app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")

    @app.get("/")
    async def root():
        return {
            "app": "Remote PDF Review",
            "version": "1.0.0",
            "status": "running",
            "docs": "/docs"
        }

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    print(f"🚀 Remote PDF Review Backend starting on port {settings.PORT}")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
