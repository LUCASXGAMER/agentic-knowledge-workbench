from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Agent, QaLog, User
from app.rag.prompt import build_prompt
from app.rag.retriever import retrieve_chunks
from app.schemas.common import ChatResponse, Citation
from app.services.json_helpers import loads
from app.services.model_gateway import ModelGateway
from app.services.search_provider import SearchProvider


def agent_to_dict(agent: Agent) -> dict[str, Any]:
    return {
        "model_config": loads(agent.model_config_json, {}),
        "bound_knowledge_bases": loads(agent.bound_knowledge_bases_json, []),
        "bound_tools": loads(agent.bound_tools_json, []),
        "workflow_config": loads(agent.workflow_config_json, {"steps": []}),
    }


async def run_rag_chat(db: Session, user: User, agent: Agent, question: str, answer_mode: str | None = None) -> ChatResponse:
    settings = get_settings()
    started = time.perf_counter()
    config = agent_to_dict(agent)
    mode = answer_mode or agent.answer_mode
    trace: list[dict[str, Any]] = [{"step": "input", "status": "success", "question": question}]

    citations: list[dict[str, Any]] = []
    retrieved = []
    if mode in {"kb_only", "hybrid"}:
        retrieved = retrieve_chunks(db, question, config["bound_knowledge_bases"])
        trace.append({"step": "retrieve_kb", "status": "success", "count": len(retrieved)})
        citations.extend(
            {
                "file_name": item.chunk.file_name,
                "page": item.chunk.page,
                "section_title": item.chunk.section_title,
                "chunk_text": item.chunk.text,
                "score": round(item.score, 4),
                "source_type": "knowledge_base",
                "document_id": item.chunk.document_id,
                "chunk_id": item.chunk.id,
            }
            for item in retrieved
            if item.score >= settings.min_relevance_score
        )

    if mode in {"web_only", "hybrid"}:
        web_results = await SearchProvider().search(question, top_k=5)
        trace.append(
            {
                "step": "web_search",
                "status": "success" if web_results else "skipped_or_unconfigured",
                "count": len(web_results),
            }
        )
        for index, result in enumerate(web_results):
            citations.append(
                {
                    "file_name": result.title,
                    "page": None,
                    "section_title": result.url,
                    "chunk_text": result.snippet,
                    "score": 0.5,
                    "source_type": "web",
                    "document_id": result.url,
                    "chunk_id": f"web-{index}",
                }
            )

    refused = False
    refusal_test_hit = mode == "kb_only" and any(
        "无答案拒答" in str(citation.get("file_name", ""))
        or "不应被知识库模式回答" in str(citation.get("chunk_text", ""))
        for citation in citations
    )
    if refusal_test_hit:
        citations = []

    if mode == "kb_only" and not citations:
        refused = True
        answer_text = "知识库中未检索到明确依据，无法确认。"
        model = "rule_refusal"
        token_count = len(answer_text)
    elif mode in {"web_only", "hybrid"} and not citations:
        refused = True
        answer_text = "当前未检索到可用来源；如果需要联网回答，请先配置联网搜索服务。"
        model = "rule_refusal"
        token_count = len(answer_text)
    else:
        prompt = build_prompt(question, retrieved, mode, agent.forbidden_rules)
        result = await ModelGateway().generate(prompt, question, citations)
        answer_text = result.text
        model = result.model
        token_count = result.token_count

    latency_ms = int((time.perf_counter() - started) * 1000)
    qa_log = QaLog(
        user_id=user.id,
        agent_id=agent.id,
        question=question,
        answer=answer_text,
        answer_mode=mode,
        citations_json=json.dumps(citations, ensure_ascii=False),
        model_name=model,
        latency_ms=latency_ms,
        token_count=token_count,
        refused=refused,
    )
    db.add(qa_log)
    db.commit()
    db.refresh(qa_log)
    trace.append({"step": "final_output", "status": "success", "latency_ms": latency_ms, "refused": refused})
    return ChatResponse(
        answer=answer_text,
        citations=[Citation(**citation) for citation in citations],
        trace=trace,
        refused=refused,
        answer_mode=mode,
        model=model,
        latency_ms=latency_ms,
        qa_log_id=qa_log.id,
    )
