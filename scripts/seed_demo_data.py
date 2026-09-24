from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.init_db import create_tables, seed_defaults  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.entities import Document, KnowledgeBase  # noqa: E402
from app.services.ingestion import ingest_document, safe_upload_path  # noqa: E402


def choose_kb(file_name: str, kbs: dict[str, KnowledgeBase]) -> KnowledgeBase:
    if "合同" in file_name:
        return kbs["合同库"]
    if "技术" in file_name or "信息安全" in file_name:
        return kbs["技术库"]
    if "会议" in file_name:
        return kbs["会议纪要库"]
    if "费用" in file_name or "项目" in file_name or "设备" in file_name:
        return kbs["项目库"]
    return kbs["制度库"]


def main() -> None:
    settings = get_settings()
    create_tables()
    with SessionLocal() as db:
        seed_defaults(db)
        kbs = {kb.name: kb for kb in db.scalars(select(KnowledgeBase)).all()}
        for source in sorted((ROOT / "sample_data" / "documents").glob("*")):
            if not source.is_file():
                continue
            kb = choose_kb(source.name, kbs)
            target = safe_upload_path(settings.upload_dir, source.name)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            exists = db.scalar(select(Document).where(Document.file_name == target.name, Document.kb_id == kb.id))
            if exists:
                continue
            document = Document(kb_id=kb.id, file_name=target.name, file_type=target.suffix.lstrip("."), file_path=str(target))
            db.add(document)
            db.commit()
            db.refresh(document)
            ingest_document(db, document)
            print(f"已导入：{source.name} -> {kb.name}")
    print("演示数据初始化完成。")


if __name__ == "__main__":
    main()
