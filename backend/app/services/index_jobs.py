from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.entities import Document, IndexJob, KnowledgeBase
from app.services.audit import record_audit
from app.services.ingestion import ingest_document


def create_rebuild_job(db: Session, kb: KnowledgeBase, user_id: str | None) -> IndexJob:
    total = db.scalar(select(func.count(Document.id)).where(Document.kb_id == kb.id)) or 0
    job = IndexJob(
        kb_id=kb.id,
        status="queued",
        total_documents=total,
        processed_documents=0,
        chunk_count=0,
        created_by=user_id,
    )
    db.add(job)
    db.flush()
    record_audit(
        db,
        user_id=user_id,
        action="knowledge_base.rebuild_queued",
        target_type="knowledge_base",
        target_id=kb.id,
        detail={"name": kb.name, "job_id": job.id, "documents": total},
    )
    db.commit()
    db.refresh(job)
    return job


def run_rebuild_job(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(IndexJob, job_id)
        if not job:
            return
        kb = db.get(KnowledgeBase, job.kb_id)
        if not kb:
            job.status = "failed"
            job.error_message = "知识库不存在"
            db.commit()
            return

        job.status = "running"
        job.error_message = ""
        db.commit()

        documents = db.scalars(
            select(Document).where(Document.kb_id == job.kb_id).order_by(Document.created_at.asc())
        ).all()
        job.total_documents = len(documents)
        job.processed_documents = 0
        job.chunk_count = 0
        db.commit()

        try:
            chunks = 0
            for document in documents:
                current = ingest_document(db, document)
                chunks += current.chunk_count
                job = db.get(IndexJob, job_id)
                if not job:
                    return
                job.status = "running"
                job.processed_documents += 1
                job.chunk_count = chunks
                db.commit()

            job = db.get(IndexJob, job_id)
            if job:
                job.status = "success"
                job.chunk_count = chunks
                record_audit(
                    db,
                    user_id=job.created_by,
                    action="knowledge_base.rebuild_finished",
                    target_type="knowledge_base",
                    target_id=job.kb_id,
                    detail={"job_id": job.id, "documents": job.processed_documents, "chunks": job.chunk_count},
                )
                db.commit()
        except Exception as exc:  # pragma: no cover - exercised through integration paths
            job = db.get(IndexJob, job_id)
            if job:
                job.status = "failed"
                job.error_message = str(exc)
                db.commit()
