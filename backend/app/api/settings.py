from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.core.config import get_settings
from app.models.entities import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/model")
def model_settings(_: User = Depends(require_roles("admin"))) -> dict:
    settings = get_settings()
    return {
        "deploy_profile": settings.deploy_profile,
        "llm_provider": settings.llm_provider,
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "use_mock_llm": settings.use_mock_llm,
        "embedding_model_name": settings.embedding_model_name,
        "embedding_device": settings.embedding_device,
        "vector_store_provider": settings.vector_store_provider,
        "qdrant_url": settings.qdrant_url,
        "qdrant_collection": settings.qdrant_collection,
        "enable_reranker": settings.enable_reranker,
        "reranker_device": settings.reranker_device,
        "enable_ocr": settings.enable_ocr,
        "ocr_device": settings.ocr_device,
        "enable_web_search": settings.enable_web_search,
        "max_concurrent_llm_requests": settings.max_concurrent_llm_requests,
    }
