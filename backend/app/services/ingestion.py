from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Chunk, Document, KnowledgeBase
from app.rag.chunking import estimate_tokens, split_text
from app.rag.embedding import HashEmbeddingProvider
from app.rag.vector_store import get_vector_store
from app.services.document_parser import parse_document


def ingest_document(db: Session, document: Document) -> Document:
    settings = get_settings()
    parsed = parse_document(document.file_path)
    db.execute(delete(Chunk).where(Chunk.document_id == document.id))

    embedder = HashEmbeddingProvider()
    chunk_count = 0
    indexed_chunks: list[Chunk] = []
    for page in parsed.pages:
        chunks = split_text(
            page.text,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            page=page.page,
            section_title=page.section_title,
        )
        for item in chunks:
            vector = embedder.embed(item.text)
            chunk = Chunk(
                document_id=document.id,
                kb_id=document.kb_id,
                file_name=document.file_name,
                page=item.page,
                section_title=item.section_title,
                text=item.text,
                token_count=estimate_tokens(item.text),
                embedding_json=json.dumps(vector),
                version=document.version,
                embedding_model=settings.embedding_model_name,
            )
            db.add(chunk)
            indexed_chunks.append(chunk)
            chunk_count += 1

    db.flush()
    vector_status = get_vector_store().sync_document(document.id, indexed_chunks)
    document.page_count = len(parsed.pages)
    document.chunk_count = chunk_count
    document.status = "parsed" if chunk_count else "empty"
    document.parse_message = parsed.message if vector_status in {"sqlite", "qdrant", "qdrant_empty"} else f"{parsed.message}；向量库同步未完成"

    kb = db.get(KnowledgeBase, document.kb_id)
    if kb:
        kb.document_count = db.scalar(select(func.count(Document.id)).where(Document.kb_id == kb.id)) or 0
        kb.chunk_count = db.scalar(select(func.count(Chunk.id)).where(Chunk.kb_id == kb.id)) or 0
    db.commit()
    db.refresh(document)
    return document


def safe_upload_path(upload_dir: str, file_name: str) -> Path:
    cleaned = Path(file_name).name.replace("..", "_")
    return Path(upload_dir) / cleaned
