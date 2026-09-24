from __future__ import annotations

import json
from typing import Protocol

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Chunk
from app.rag.embedding import cosine_similarity


class VectorStore(Protocol):
    def search_scores(self, db: Session, query_vector: list[float], kb_ids: list[str], top_k: int) -> dict[str, float]:
        ...

    def sync_document(self, document_id: str, chunks: list[Chunk]) -> str:
        ...


class SQLiteVectorStore:
    def search_scores(self, db: Session, query_vector: list[float], kb_ids: list[str], top_k: int) -> dict[str, float]:
        chunks = db.scalars(select(Chunk).where(Chunk.kb_id.in_(kb_ids))).all()
        scored: list[tuple[str, float]] = []
        for chunk in chunks:
            try:
                vector = json.loads(chunk.embedding_json)
            except json.JSONDecodeError:
                vector = []
            scored.append((chunk.id, max(cosine_similarity(query_vector, vector), 0.0)))
        scored.sort(key=lambda item: item[1], reverse=True)
        return dict(scored[:top_k])

    def sync_document(self, document_id: str, chunks: list[Chunk]) -> str:
        return "sqlite"


class QdrantVectorStore:
    def __init__(self) -> None:
        settings = get_settings()
        self.url = settings.qdrant_url.rstrip("/")
        self.collection = settings.qdrant_collection

    def _ensure_collection(self, vector_size: int) -> bool:
        try:
            with httpx.Client(timeout=3.0) as client:
                current = client.get(f"{self.url}/collections/{self.collection}")
                if current.status_code == 200:
                    return True
                create = client.put(
                    f"{self.url}/collections/{self.collection}",
                    json={"vectors": {"size": vector_size, "distance": "Cosine"}},
                )
                return create.status_code in {200, 201}
        except httpx.HTTPError:
            return False

    def search_scores(self, db: Session, query_vector: list[float], kb_ids: list[str], top_k: int) -> dict[str, float]:
        if not query_vector or not self._ensure_collection(len(query_vector)):
            return {}
        try:
            with httpx.Client(timeout=3.0) as client:
                response = client.post(
                    f"{self.url}/collections/{self.collection}/points/search",
                    json={
                        "vector": query_vector,
                        "limit": top_k,
                        "with_payload": True,
                        "filter": {"must": [{"key": "kb_id", "match": {"any": kb_ids}}]},
                    },
                )
                if response.status_code >= 400:
                    return {}
                hits = response.json().get("result", [])
                return {
                    str(hit.get("payload", {}).get("chunk_id") or hit.get("id")): max(float(hit.get("score", 0.0)), 0.0)
                    for hit in hits
                }
        except (httpx.HTTPError, ValueError, TypeError):
            return {}

    def sync_document(self, document_id: str, chunks: list[Chunk]) -> str:
        if not chunks:
            return "qdrant_empty"
        try:
            first_vector = json.loads(chunks[0].embedding_json)
        except json.JSONDecodeError:
            first_vector = []
        if not first_vector or not self._ensure_collection(len(first_vector)):
            return "qdrant_unavailable"

        points = []
        for chunk in chunks:
            try:
                vector = json.loads(chunk.embedding_json)
            except json.JSONDecodeError:
                continue
            points.append(
                {
                    "id": chunk.id,
                    "vector": vector,
                    "payload": {
                        "chunk_id": chunk.id,
                        "document_id": chunk.document_id,
                        "kb_id": chunk.kb_id,
                        "file_name": chunk.file_name,
                        "page": chunk.page,
                        "section_title": chunk.section_title,
                        "source_type": chunk.source_type,
                        "version": chunk.version,
                        "embedding_model": chunk.embedding_model,
                    },
                }
            )
        if not points:
            return "qdrant_empty"
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    f"{self.url}/collections/{self.collection}/points/delete",
                    json={"filter": {"must": [{"key": "document_id", "match": {"value": document_id}}]}},
                )
                response = client.put(f"{self.url}/collections/{self.collection}/points?wait=true", json={"points": points})
                return "qdrant" if response.status_code < 400 else "qdrant_unavailable"
        except httpx.HTTPError:
            return "qdrant_unavailable"


def get_vector_store() -> VectorStore:
    settings = get_settings()
    if settings.vector_store_provider.lower() == "qdrant":
        return QdrantVectorStore()
    return SQLiteVectorStore()
