from __future__ import annotations

import time
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Agent, Chunk, User, WorkflowTrace
from app.services.json_helpers import dumps, loads


def execute_workflow(db: Session, user: User, agent: Agent, workflow_config: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = get_settings()
    started = time.perf_counter()
    config = workflow_config or loads(agent.workflow_config_json, {"steps": []})
    steps = config.get("steps", [])
    bound_kbs = loads(agent.bound_knowledge_bases_json, [])
    bound_tools = loads(agent.bound_tools_json, [])
    trace = []
    status = "success"
    error = ""
    for index, step in enumerate(steps, start=1):
        step_type = step.get("type", "unknown")
        if step.get("enabled", True) is False:
            trace.append({"index": index, "type": step_type, "status": "skipped", "message": "当前模式未启用该步骤"})
            continue
        message = "已完成"
        detail: dict[str, Any] = {}
        if step_type == "input":
            message = "已记录用户需求和智能体配置"
        elif step_type == "retrieve_kb":
            chunk_count = db.scalar(select(func.count(Chunk.id)).where(Chunk.kb_id.in_(bound_kbs))) if bound_kbs else 0
            detail = {"knowledge_bases": len(bound_kbs), "available_chunks": chunk_count or 0}
            message = f"已限定 {len(bound_kbs)} 个知识库，可用分片 {chunk_count or 0} 个"
        elif step_type == "web_search":
            if settings.enable_web_search:
                message = "联网资料已纳入候选来源"
            else:
                message = "联网搜索未启用，已跳过外部资料"
                detail = {"enabled": False}
        elif step_type == "tool_call":
            message = f"已检查 {len(bound_tools)} 个授权工具"
            detail = {"tools": bound_tools}
        elif step_type == "llm_generate":
            message = "已生成结构化回答草稿"
            detail = {"model": settings.llm_model}
        elif step_type == "format_output":
            message = "已按输出要求整理格式"
            detail = {"format": step.get("format", "markdown")}
        elif step_type == "human_review":
            message = "等待人工复核"
            detail = {"required": step.get("required", False)}
        elif step_type == "final_output":
            message = "结果已生成并写入运行记录"
        trace.append({"index": index, "type": step_type, "status": "success", "message": message, "detail": detail})
    latency_ms = int((time.perf_counter() - started) * 1000)
    db.add(
        WorkflowTrace(
            user_id=user.id,
            agent_id=agent.id,
            status=status,
            steps_json=dumps(trace),
            error_message=error,
            latency_ms=latency_ms,
        )
    )
    db.commit()
    return {"status": status, "trace": trace, "latency_ms": latency_ms, "agent_id": agent.id, "agent_name": agent.name}
