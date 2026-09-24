from __future__ import annotations

import csv
import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import Chunk, Document, EvalRun, KnowledgeBase, User
from app.rag.retriever import retrieve_chunks
from app.services.audit import record_audit
from app.services.json_helpers import loads

router = APIRouter(prefix="/api/eval", tags=["eval"])


@router.get("/runs")
def list_eval_runs(
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [
        {
            "id": item.id,
            "name": item.name,
            "status": item.status,
            "metrics": loads(item.metrics_json, {}),
            "report_path": item.report_path,
            "created_at": item.created_at,
        }
        for item in db.scalars(select(EvalRun).order_by(EvalRun.created_at.desc())).all()
    ]


def _load_sample_cases() -> list[dict[str, str]]:
    path = Path(__file__).resolve().parents[3] / "sample_data/eval_cases/eval_cases.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def metrics_from_ranks(ranks: list[int | None]) -> dict:
    """One expected document per answerable query; absent evidence counts as a miss."""
    count = len(ranks)
    return {
        "evaluated_cases": count,
        "top1_hit_rate": sum(rank == 1 for rank in ranks) / count if count else None,
        "top3_hit_rate": sum(rank is not None and rank <= 3 for rank in ranks) / count if count else None,
        "top5_hit_rate": sum(rank is not None and rank <= 5 for rank in ranks) / count if count else None,
        "mrr": sum(1 / rank for rank in ranks if rank is not None) / count if count else None,
    }


def _sample_metrics(db: Session, cases: list[dict[str, str]]) -> dict:
    documents = {d.id: d.file_name for d in db.scalars(select(Document)).all()}
    kb_ids = list(db.scalars(select(KnowledgeBase.id)).all())
    answerable = [c for c in cases if c.get("expected_behavior") == "answer" and c.get("expected_document")]
    corpus_ready = bool(db.scalar(select(Chunk.id).limit(1)))
    ranks: list[int | None] = []
    if corpus_ready:
        for case in answerable:
            retrieved = retrieve_chunks(db, case["question"], kb_ids)
            expected = case["expected_document"]
            # Return document ranks, deduplicating multiple chunks from the same document.
            retrieved_docs = list(dict.fromkeys(item.chunk.document_id for item in retrieved))
            rank = next((i for i, doc_id in enumerate(retrieved_docs, 1)
                         if documents.get(doc_id, "") == expected), None)
            ranks.append(rank)
    return {
        "total_cases": len(cases),
        "answerable_cases": len(answerable),
        "routing_cases_not_evaluated": len(cases) - len(answerable),
        **metrics_from_ranks(ranks),
    }


@router.post("/sample")
def create_sample_eval(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> dict:
    cases = _load_sample_cases()
    metrics = _sample_metrics(db, cases)
    run = EvalRun(
        name="synthetic_retrieval_eval",
        status="success" if metrics["evaluated_cases"] else "not_ready",
        metrics_json=json.dumps(metrics, ensure_ascii=False),
        report_path="",
    )
    db.add(run)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="eval.run_sample",
        target_type="eval_run",
        target_id=run.id,
        detail={"total_cases": metrics["total_cases"]},
    )
    db.commit()
    return {"status": "created", "id": run.id}
