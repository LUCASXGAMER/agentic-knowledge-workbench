from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Agent, User
from app.services.agent_access import user_can_access_agent
from app.workflows.executor import execute_workflow

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class WorkflowRunRequest(BaseModel):
    agent_id: str
    workflow_config: dict | None = None


@router.post("/run")
def run_workflow(
    payload: WorkflowRunRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    agent = db.get(Agent, payload.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="智能体不存在")
    if not agent.enabled and user.role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="当前智能体不可用")
    if not user_can_access_agent(db, user, agent):
        raise HTTPException(status_code=403, detail="当前账号未授权使用该智能体")
    return execute_workflow(db, user, agent, payload.workflow_config)
