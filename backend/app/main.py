from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, auth, chat, dashboard, documents, evals, health, knowledge_bases, logs, settings, tools, users, workflows
from app.core.config import ensure_runtime_dirs, get_settings
from app.core.logging import configure_logging
from app.db.init_db import create_tables, seed_defaults
from app.db.session import SessionLocal


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    ensure_runtime_dirs()
    create_tables()
    with SessionLocal() as db:
        seed_defaults(db)
    yield


def create_app() -> FastAPI:
    current = get_settings()
    app = FastAPI(title=current.app_name, version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(dashboard.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(knowledge_bases.router)
    app.include_router(documents.router)
    app.include_router(agents.router)
    app.include_router(chat.router)
    app.include_router(tools.router)
    app.include_router(workflows.router)
    app.include_router(evals.router)
    app.include_router(logs.router)
    app.include_router(settings.router)
    return app


app = create_app()
