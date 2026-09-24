from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


def load_env_file(path: str | Path) -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_name: str = "enterprise-agent-rag-template"
    app_env: str = field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    deploy_profile: str = field(default_factory=lambda: os.getenv("DEPLOY_PROFILE", "dev-local-mac"))
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    frontend_port: int = field(default_factory=lambda: env_int("FRONTEND_PORT", 8080))
    backend_port: int = field(default_factory=lambda: env_int("BACKEND_PORT", 8000))

    admin_email: str = field(default_factory=lambda: os.getenv("ADMIN_EMAIL", "admin@example.com"))
    admin_password: str = field(default_factory=lambda: os.getenv("ADMIN_PASSWORD", "ChangeMe123!"))
    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", "dev-local-secret-change-before-sharing"))
    access_token_minutes: int = field(default_factory=lambda: env_int("ACCESS_TOKEN_MINUTES", 60 * 8))

    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "mock"))
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", "http://host.docker.internal:11434/v1"))
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", "EMPTY"))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "qwen-dev"))
    llm_temperature: float = field(default_factory=lambda: float(os.getenv("LLM_TEMPERATURE", "0.1")))
    llm_max_tokens: int = field(default_factory=lambda: env_int("LLM_MAX_TOKENS", 2048))
    use_mock_llm: bool = field(default_factory=lambda: env_bool("USE_MOCK_LLM", True))
    max_concurrent_llm_requests: int = field(default_factory=lambda: env_int("MAX_CONCURRENT_LLM_REQUESTS", 1))

    embedding_model_name: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL_NAME", "hash-embedding-demo"))
    embedding_model_path: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL_PATH", "./models/embedding/bge-small-zh"))
    embedding_device: str = field(default_factory=lambda: os.getenv("EMBEDDING_DEVICE", "cpu"))
    enable_reranker: bool = field(default_factory=lambda: env_bool("ENABLE_RERANKER", False))
    reranker_model_path: str = field(default_factory=lambda: os.getenv("RERANKER_MODEL_PATH", "./models/reranker/bge-reranker-base"))
    reranker_device: str = field(default_factory=lambda: os.getenv("RERANKER_DEVICE", "cpu"))

    enable_ocr: bool = field(default_factory=lambda: env_bool("ENABLE_OCR", True))
    ocr_device: str = field(default_factory=lambda: os.getenv("OCR_DEVICE", "cpu"))
    ocr_min_text_chars: int = field(default_factory=lambda: env_int("OCR_MIN_TEXT_CHARS", 30))

    enable_web_search: bool = field(default_factory=lambda: env_bool("ENABLE_WEB_SEARCH", False))
    search_provider: str = field(default_factory=lambda: os.getenv("SEARCH_PROVIDER", "disabled"))
    search_base_url: str = field(default_factory=lambda: os.getenv("SEARCH_BASE_URL", ""))
    search_api_key: str = field(default_factory=lambda: os.getenv("SEARCH_API_KEY", ""))

    chunk_size: int = field(default_factory=lambda: env_int("CHUNK_SIZE", 700))
    chunk_overlap: int = field(default_factory=lambda: env_int("CHUNK_OVERLAP", 120))
    vector_top_k: int = field(default_factory=lambda: env_int("VECTOR_TOP_K", 20))
    bm25_top_k: int = field(default_factory=lambda: env_int("BM25_TOP_K", 20))
    rerank_top_k: int = field(default_factory=lambda: env_int("RERANK_TOP_K", 8))
    final_top_k: int = field(default_factory=lambda: env_int("FINAL_TOP_K", 5))
    min_relevance_score: float = field(default_factory=lambda: float(os.getenv("MIN_RELEVANCE_SCORE", "0.05")))

    data_dir: str = field(default_factory=lambda: os.getenv("DATA_DIR", "./data"))
    upload_dir: str = field(default_factory=lambda: os.getenv("UPLOAD_DIR", "./data/uploads"))
    parsed_dir: str = field(default_factory=lambda: os.getenv("PARSED_DIR", "./data/parsed"))
    vector_db_dir: str = field(default_factory=lambda: os.getenv("VECTOR_DB_DIR", "./data/qdrant"))
    sqlite_path: str = field(default_factory=lambda: os.getenv("SQLITE_PATH", "./data/sqlite/app.db"))
    log_dir: str = field(default_factory=lambda: os.getenv("LOG_DIR", "./data/logs"))
    vector_store_provider: str = field(default_factory=lambda: os.getenv("VECTOR_STORE_PROVIDER", "sqlite"))
    qdrant_url: str = field(default_factory=lambda: os.getenv("QDRANT_URL", "http://qdrant:6333"))
    qdrant_collection: str = field(default_factory=lambda: os.getenv("QDRANT_COLLECTION", "enterprise_documents"))

    allowed_upload_types: str = field(
        default_factory=lambda: os.getenv(
            "ALLOWED_UPLOAD_TYPES",
            ".pdf,.docx,.xlsx,.csv,.txt,.md,.markdown,.png,.jpg,.jpeg",
        )
    )
    max_upload_mb: int = field(default_factory=lambda: env_int("MAX_UPLOAD_MB", 200))


@lru_cache
def get_settings() -> Settings:
    env_file = os.getenv("ENV_FILE")
    if env_file:
        load_env_file(env_file)
    elif Path(".env").exists():
        load_env_file(".env")
    return Settings()


def ensure_runtime_dirs(settings: Settings | None = None) -> None:
    current = settings or get_settings()
    for value in [
        current.data_dir,
        current.upload_dir,
        current.parsed_dir,
        current.vector_db_dir,
        Path(current.sqlite_path).parent,
        current.log_dir,
    ]:
        Path(value).mkdir(parents=True, exist_ok=True)
