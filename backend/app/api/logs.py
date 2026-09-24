from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import Agent, AuditLog, QaLog, ToolCallLog, User, WorkflowTrace
from app.services.json_helpers import loads

router = APIRouter(prefix="/api/logs", tags=["logs"])


def build_name_maps(db: Session, *, user_ids: set[str | None], agent_ids: set[str | None]) -> tuple[dict[str, str], dict[str, str]]:
    clean_user_ids = {item for item in user_ids if item}
    clean_agent_ids = {item for item in agent_ids if item}
    users = db.scalars(select(User).where(User.id.in_(clean_user_ids))).all() if clean_user_ids else []
    agents = db.scalars(select(Agent).where(Agent.id.in_(clean_agent_ids))).all() if clean_agent_ids else []
    user_names = {item.id: item.full_name or item.email for item in users}
    agent_names = {item.id: item.name for item in agents}
    return user_names, agent_names


@router.get("/qa")
def qa_logs(_: User = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(QaLog).order_by(QaLog.created_at.desc()).limit(200)).all()
    user_names, agent_names = build_name_maps(
        db,
        user_ids={item.user_id for item in rows},
        agent_ids={item.agent_id for item in rows},
    )
    return [
        {
            "id": item.id,
            "user_id": item.user_id,
            "user_name": user_names.get(item.user_id or "", "未知用户"),
            "agent_id": item.agent_id,
            "agent_name": agent_names.get(item.agent_id or "", "未知智能体"),
            "question": item.question,
            "answer": item.answer,
            "answer_mode": item.answer_mode,
            "citation_count": len(loads(item.citations_json, [])),
            "refused": item.refused,
            "latency_ms": item.latency_ms,
            "created_at": item.created_at,
        }
        for item in rows
    ]


@router.get("/tools")
def tool_logs(_: User = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(ToolCallLog).order_by(ToolCallLog.created_at.desc()).limit(200)).all()
    user_names, agent_names = build_name_maps(
        db,
        user_ids={item.user_id for item in rows},
        agent_ids={item.agent_id for item in rows},
    )
    return [
        {
            "id": item.id,
            "user_name": user_names.get(item.user_id or "", "系统"),
            "agent_name": agent_names.get(item.agent_id or "", "-"),
            "tool_name": item.tool_name,
            "status": item.status,
            "latency_ms": item.latency_ms,
            "error_message": item.error_message,
            "created_at": item.created_at,
        }
        for item in rows
    ]


@router.get("/workflows")
def workflow_logs(_: User = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(WorkflowTrace).order_by(WorkflowTrace.created_at.desc()).limit(200)).all()
    user_names, agent_names = build_name_maps(
        db,
        user_ids={item.user_id for item in rows},
        agent_ids={item.agent_id for item in rows},
    )
    return [
        {
            "id": item.id,
            "user_name": user_names.get(item.user_id or "", "系统"),
            "agent_id": item.agent_id,
            "agent_name": agent_names.get(item.agent_id or "", "未知智能体"),
            "status": item.status,
            "steps": loads(item.steps_json, []),
            "latency_ms": item.latency_ms,
            "created_at": item.created_at,
        }
        for item in rows
    ]


@router.get("/audit")
def audit_logs(_: User = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)).all()
    user_names, _ = build_name_maps(db, user_ids={item.user_id for item in rows}, agent_ids=set())
    return [
        {
            "id": item.id,
            "user_id": item.user_id,
            "user_name": user_names.get(item.user_id or "", "系统"),
            "action": item.action,
            "target_type": item.target_type,
            "target_id": item.target_id,
            "detail": loads(item.detail_json, {}),
            "created_at": item.created_at,
        }
        for item in rows
    ]
