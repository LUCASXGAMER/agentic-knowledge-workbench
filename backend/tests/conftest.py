from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TEST_DATA = ROOT / "data" / "test"
TEST_DB = TEST_DATA / "sqlite" / "test_app.db"

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEPLOY_PROFILE", "dev-local-mac")
os.environ.setdefault("DATA_DIR", str(TEST_DATA))
os.environ.setdefault("UPLOAD_DIR", str(TEST_DATA / "uploads"))
os.environ.setdefault("PARSED_DIR", str(TEST_DATA / "parsed"))
os.environ.setdefault("VECTOR_DB_DIR", str(TEST_DATA / "qdrant"))
os.environ.setdefault("SQLITE_PATH", str(TEST_DB))
os.environ.setdefault("LOG_DIR", str(TEST_DATA / "logs"))
os.environ.setdefault("USE_MOCK_LLM", "true")

for path in [
    TEST_DATA / "uploads",
    TEST_DATA / "parsed",
    TEST_DATA / "qdrant",
    TEST_DATA / "sqlite",
    TEST_DATA / "logs",
]:
    path.mkdir(parents=True, exist_ok=True)

if TEST_DB.exists():
    TEST_DB.unlink()
