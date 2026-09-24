from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Chunk, Document, IndexJob, KnowledgeBase, User
from app.schemas.common import ChunkRead, DocumentRead, IndexJobRead, KnowledgeBaseCreate, KnowledgeBaseRead
from app.services.audit import record_audit
from app.services.index_jobs import create_rebuild_job, run_rebuild_job

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])


def normalize_kb_name(name: str) -> str:
    return " ".join(name.strip().split())


def ensure_unique_kb_name(db: Session, name: str) -> str:
    normalized = normalize_kb_name(name)
    if not normalized:
        raise HTTPException(status_code=400, detail="知识库名称不能为空")
    if db.scalar(select(KnowledgeBase).where(func.lower(KnowledgeBase.name) == normalized.lower())):
        raise HTTPException(status_code=409, detail="已存在同名知识库，请使用不同名称")
    return normalized


@router.get("", response_model=list[KnowledgeBaseRead])
def list_kbs(
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[KnowledgeBaseRead]:
    return [KnowledgeBaseRead.model_validate(item) for item in db.scalars(select(KnowledgeBase).order_by(KnowledgeBase.created_at.asc())).all()]


@router.post("", response_model=KnowledgeBaseRead)
def create_kb(
    payload: KnowledgeBaseCreate,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> KnowledgeBaseRead:
    settings = get_settings()
    kb_name = ensure_unique_kb_name(db, payload.name)
    kb = KnowledgeBase(
        name=kb_name,
        description=payload.description,
        visibility=payload.visibility,
        chunking_strategy=payload.chunking_strategy,
        embedding_model=settings.embedding_model_name,
        owner_id=user.id,
    )
    db.add(kb)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="knowledge_base.create",
        target_type="knowledge_base",
        target_id=kb.id,
        detail={"name": kb.name, "visibility": kb.visibility},
    )
    db.commit()
    db.refresh(kb)
    return KnowledgeBaseRead.model_validate(kb)


@router.get("/{kb_id}", response_model=KnowledgeBaseRead)
def get_kb(kb_id: str, _: User = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> KnowledgeBaseRead:
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return KnowledgeBaseRead.model_validate(kb)


@router.delete("/{kb_id}")
def delete_kb(
    kb_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    for chunk in db.scalars(select(Chunk).where(Chunk.kb_id == kb_id)).all():
        db.delete(chunk)
    for document in db.scalars(select(Document).where(Document.kb_id == kb_id)).all():
        db.delete(document)
    for job in db.scalars(select(IndexJob).where(IndexJob.kb_id == kb_id)).all():
        db.delete(job)
    record_audit(
        db,
        user_id=_.id,
        action="knowledge_base.delete",
        target_type="knowledge_base",
        target_id=kb.id,
        detail={"name": kb.name},
    )
    db.delete(kb)
    db.commit()
    return {"status": "deleted"}


@router.post("/{kb_id}/rebuild")
def rebuild_kb(
    kb_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> IndexJobRead:
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    job = create_rebuild_job(db, kb, user.id)
    background_tasks.add_task(run_rebuild_job, job.id)
    return IndexJobRead.model_validate(job)


@router.get("/{kb_id}/rebuild-jobs", response_model=list[IndexJobRead])
def list_rebuild_jobs(
    kb_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[IndexJobRead]:
    if not db.get(KnowledgeBase, kb_id):
        raise HTTPException(status_code=404, detail="知识库不存在")
    return [
        IndexJobRead.model_validate(item)
        for item in db.scalars(select(IndexJob).where(IndexJob.kb_id == kb_id).order_by(IndexJob.created_at.desc()).limit(20)).all()
    ]


@router.get("/{kb_id}/documents", response_model=list[DocumentRead])
def list_kb_documents(
    kb_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    return [
        DocumentRead.model_validate(item)
        for item in db.scalars(select(Document).where(Document.kb_id == kb_id).order_by(Document.created_at.desc())).all()
    ]


@router.get("/{kb_id}/chunks", response_model=list[ChunkRead])
def list_kb_chunks(
    kb_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[ChunkRead]:
    return [
        ChunkRead.model_validate(item)
        for item in db.scalars(select(Chunk).where(Chunk.kb_id == kb_id).order_by(Chunk.created_at.desc()).limit(200)).all()
    ]
