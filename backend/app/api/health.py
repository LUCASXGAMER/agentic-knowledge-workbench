from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    database_status = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
    except Exception as exc:
        database_status = f"error: {exc}"
    return HealthResponse(
        status="ok" if database_status == "ok" else "degraded",
        app=settings.app_name,
        app_env=settings.app_env,
        deploy_profile=settings.deploy_profile,
        database=database_status,
        llm_provider=settings.llm_provider,
        use_mock_llm=settings.use_mock_llm,
        embedding_model=settings.embedding_model_name,
        vector_store_provider=settings.vector_store_provider,
        web_search_enabled=settings.enable_web_search,
        qdrant_url=settings.qdrant_url,
    )


@router.get("/api/health", response_model=HealthResponse)
def api_health() -> HealthResponse:
    return health()
