from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Chunk, Document, KnowledgeBase, User
from app.schemas.common import ChunkRead, DocumentRead
from app.services.audit import record_audit
from app.services.ingestion import ingest_document, safe_upload_path

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentRead])
def list_documents(
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    return [
        DocumentRead.model_validate(item)
        for item in db.scalars(select(Document).order_by(Document.created_at.desc()).limit(500)).all()
    ]


@router.get("/chunks", response_model=list[ChunkRead])
def list_chunks(
    kb_id: str | None = None,
    document_id: str | None = None,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[ChunkRead]:
    query = select(Chunk).order_by(Chunk.created_at.desc()).limit(500)
    if kb_id:
        query = select(Chunk).where(Chunk.kb_id == kb_id).order_by(Chunk.created_at.desc()).limit(500)
    if document_id:
        query = select(Chunk).where(Chunk.document_id == document_id).order_by(Chunk.created_at.desc()).limit(500)
    return [ChunkRead.model_validate(item) for item in db.scalars(query).all()]


@router.post("/upload/{kb_id}", response_model=DocumentRead)
def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> DocumentRead:
    settings = get_settings()
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {item.strip() for item in settings.allowed_upload_types.split(",")}:
        raise HTTPException(status_code=400, detail="文件类型不允许")
    original_name = Path(file.filename or "upload.txt").name
    safe_name = f"{uuid4().hex[:10]}_{original_name}"
    target = safe_upload_path(settings.upload_dir, safe_name)
    target.parent.mkdir(parents=True, exist_ok=True)
    max_bytes = settings.max_upload_mb * 1024 * 1024
    written = 0
    with target.open("wb") as handle:
        while chunk := file.file.read(1024 * 1024):
            written += len(chunk)
            if written > max_bytes:
                handle.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"文件超过 {settings.max_upload_mb}MB 限制")
            handle.write(chunk)
    if written == 0:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="文件内容为空")
    document = Document(
        kb_id=kb_id,
        file_name=original_name,
        file_type=suffix.lstrip("."),
        file_path=str(target),
        status="uploaded",
    )
    db.add(document)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="document.upload",
        target_type="document",
        target_id=document.id,
        detail={"file_name": document.file_name, "kb_id": kb_id, "size_bytes": written},
    )
    db.commit()
    db.refresh(document)
    document = ingest_document(db, document)
    return DocumentRead.model_validate(document)


@router.post("/{document_id}/reparse", response_model=DocumentRead)
def reparse_document(
    document_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> DocumentRead:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    return DocumentRead.model_validate(ingest_document(db, document))


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    db.execute(delete(Chunk).where(Chunk.document_id == document_id))
    db.delete(document)
    db.commit()
    return {"status": "deleted"}
