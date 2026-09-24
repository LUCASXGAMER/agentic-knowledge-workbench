from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Chunk
from app.rag.bm25 import SimpleBM25
from app.rag.embedding import HashEmbeddingProvider
from app.rag.vector_store import SQLiteVectorStore, get_vector_store


@dataclass
class RetrievedChunk:
    chunk: Chunk
    score: float
    vector_score: float
    bm25_score: float


def retrieve_chunks(db: Session, query: str, kb_ids: list[str]) -> list[RetrievedChunk]:
    settings = get_settings()
    if not kb_ids:
        return []
    chunks = list(db.scalars(select(Chunk).where(Chunk.kb_id.in_(kb_ids))).all())
    if not chunks:
        return []

    embedder = HashEmbeddingProvider()
    query_vector = embedder.embed(query)
    vector_store = get_vector_store()
    vector_scores = vector_store.search_scores(db, query_vector, kb_ids, settings.vector_top_k)
    if not vector_scores and not isinstance(vector_store, SQLiteVectorStore):
        vector_scores = SQLiteVectorStore().search_scores(db, query_vector, kb_ids, settings.vector_top_k)
    bm25 = SimpleBM25([chunk.text for chunk in chunks])
    bm25_scores = bm25.scores(query)

    results: list[RetrievedChunk] = []
    for idx, chunk in enumerate(chunks):
        vector_score = vector_scores.get(chunk.id, 0.0)
        keyword_score = bm25_scores[idx] if idx < len(bm25_scores) else 0.0
        combined = 0.65 * vector_score + 0.35 * keyword_score
        results.append(
            RetrievedChunk(
                chunk=chunk,
                score=combined,
                vector_score=vector_score,
                bm25_score=keyword_score,
            )
        )

    results.sort(key=lambda item: item.score, reverse=True)
    shortlist = results[: max(settings.vector_top_k, settings.bm25_top_k)]
    if settings.enable_reranker:
        shortlist.sort(key=lambda item: (item.score, item.bm25_score), reverse=True)
        shortlist = shortlist[: settings.rerank_top_k]
    return shortlist[: settings.final_top_k]
