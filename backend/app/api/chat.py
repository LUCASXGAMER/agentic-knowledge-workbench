from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Agent, Feedback, QaLog, User
from app.rag.pipeline import run_rag_chat
from app.schemas.common import ChatRequest, ChatResponse, FeedbackRequest
from app.services.agent_access import user_can_access_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    agent = db.get(Agent, payload.agent_id)
    if not agent or not agent.enabled:
        raise HTTPException(status_code=404, detail="智能体不存在或已禁用")
    if not user_can_access_agent(db, user, agent):
        raise HTTPException(status_code=403, detail="当前账号未授权使用该智能体")
    return await run_rag_chat(db, user, agent, payload.question, payload.answer_mode)


@router.post("/{qa_log_id}/feedback")
def submit_feedback(
    qa_log_id: str,
    payload: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    qa_log = db.get(QaLog, qa_log_id)
    if not qa_log:
        raise HTTPException(status_code=404, detail="问答记录不存在")
    feedback = Feedback(
        qa_log_id=qa_log_id,
        user_id=user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    return {"status": "saved"}
