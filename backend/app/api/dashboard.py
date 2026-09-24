from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Agent, AuditLog, Document, KnowledgeBase, QaLog, Tool, User
from app.services.agent_access import list_accessible_agents

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    today = datetime.now(UTC) - timedelta(days=1)
    kb_count = db.scalar(select(func.count(KnowledgeBase.id))) or 0
    doc_count = db.scalar(select(func.count(Document.id))) or 0
    chunk_count = db.scalar(select(func.sum(KnowledgeBase.chunk_count))) or 0
    agent_count = db.scalar(select(func.count(Agent.id))) or 0
    tool_count = db.scalar(select(func.count(Tool.id)).where(Tool.enabled.is_(True))) or 0
    qa_today = db.scalar(select(func.count(QaLog.id)).where(QaLog.created_at >= today)) or 0
    refused_today = db.scalar(select(func.count(QaLog.id)).where(QaLog.created_at >= today, QaLog.refused.is_(True))) or 0
    total_qa = db.scalar(select(func.count(QaLog.id))) or 0
    total_refused = db.scalar(select(func.count(QaLog.id)).where(QaLog.refused.is_(True))) or 0
    hit_rate = 0.0 if total_qa == 0 else round((total_qa - total_refused) / total_qa * 100, 1)
    refusal_rate = 0.0 if qa_today == 0 else round(refused_today / qa_today * 100, 1)

    is_admin = user.role in {"super_admin", "admin"}
    kbs = db.scalars(select(KnowledgeBase).order_by(KnowledgeBase.updated_at.desc()).limit(8)).all() if is_admin else []
    agents = (
        db.scalars(select(Agent).order_by(Agent.updated_at.desc()).limit(8)).all()
        if is_admin
        else list_accessible_agents(db, user)[:8]
    )
    documents = db.scalars(select(Document).order_by(Document.created_at.desc()).limit(8)).all() if is_admin else []
    qa_query = select(QaLog).order_by(QaLog.created_at.desc()).limit(20)
    if not is_admin:
        qa_query = select(QaLog).where(QaLog.user_id == user.id).order_by(QaLog.created_at.desc()).limit(20)
    qa_logs = db.scalars(qa_query).all()

    trend = []
    for offset in range(6, -1, -1):
        day_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=offset)
        day_end = day_start + timedelta(days=1)
        count = db.scalar(select(func.count(QaLog.id)).where(QaLog.created_at >= day_start, QaLog.created_at < day_end)) or 0
        refused = (
            db.scalar(
                select(func.count(QaLog.id)).where(
                    QaLog.created_at >= day_start,
                    QaLog.created_at < day_end,
                    QaLog.refused.is_(True),
                )
            )
            or 0
        )
        trend.append(
            {
                "day": day_start.strftime("%m-%d"),
                "qa": count,
                "hit": 0 if count == 0 else round((count - refused) / count * 100, 1),
            }
        )

    return {
        "metrics": [
            {"label": "知识库数量", "value": str(kb_count), "trend": f"共 {chunk_count} 个可检索片段", "tone": "blue"},
            {"label": "文档数量", "value": str(doc_count), "trend": "本地解析与入库", "tone": "green"},
            {"label": "智能体数量", "value": str(agent_count), "trend": "按权限使用", "tone": "blue"},
            {"label": "今日问答", "value": str(qa_today), "trend": f"拒答率 {refusal_rate}%", "tone": "amber"},
            {"label": "作答比例", "value": f"{hit_rate}%", "trend": "非拒答占比，不代表回答正确", "tone": "green"},
            {"label": "可用工具", "value": str(tool_count), "trend": "高风险工具默认关闭", "tone": "blue"},
        ],
        "trend": trend,
        "knowledge_bases": [
            {
                "id": kb.id,
                "name": kb.name,
                "description": kb.description,
                "documents": kb.document_count,
                "chunks": kb.chunk_count,
                "visibility": kb.visibility,
                "embedding": kb.embedding_model,
            }
            for kb in kbs
        ],
        "agents": [
            {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "answer_mode": agent.answer_mode,
                "enabled": agent.enabled,
            }
            for agent in agents
        ],
        "recent_documents": [
            {
                "id": doc.id,
                "file_name": doc.file_name,
                "kb_id": doc.kb_id,
                "status": doc.status,
                "chunk_count": doc.chunk_count,
                "created_at": doc.created_at,
            }
            for doc in documents
        ],
        "recent_qa": [
            {
                "id": item.id,
                "agent_id": item.agent_id,
                "question": item.question,
                "refused": item.refused,
                "latency_ms": item.latency_ms,
                "created_at": item.created_at,
            }
            for item in qa_logs
        ],
        "system_status": [
            {"name": "后端 API", "status": "正常", "tone": "green"},
            {"name": "数据库", "status": "正常", "tone": "green"},
            {"name": "问答模型", "status": "Mock 演示" if settings.use_mock_llm else "已配置，效果待测", "tone": "amber"},
            {"name": "联网搜索", "status": "启用" if settings.enable_web_search else "未启用", "tone": "blue"},
            {"name": "OCR", "status": "按需触发" if settings.enable_ocr else "关闭", "tone": "blue"},
        ],
    }
