from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.entities import Tool, User
from app.schemas.common import ToolRead
from app.services.audit import record_audit
from app.tools.registry import ToolExecutor

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ToolCallRequest(BaseModel):
    agent_id: str | None = None
    tool_name: str
    payload: dict = {}


class ToolUpdateRequest(BaseModel):
    enabled: bool | None = None
    require_admin_approval: bool | None = None
    callable_by_agents: bool | None = None


@router.get("", response_model=list[ToolRead])
def list_tools(
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[ToolRead]:
    return [ToolRead.model_validate(item) for item in db.scalars(select(Tool).order_by(Tool.created_at)).all()]


@router.put("/{tool_id}", response_model=ToolRead)
def update_tool(
    tool_id: str,
    payload: ToolUpdateRequest,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> ToolRead:
    tool = db.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="工具不存在")
    if tool.permission_level == "super_admin" and user.role != "super_admin":
        raise HTTPException(status_code=403, detail="该工具只能由超级管理员配置")
    if payload.enabled is not None:
        tool.enabled = payload.enabled
    if payload.require_admin_approval is not None:
        tool.require_admin_approval = payload.require_admin_approval
    if payload.callable_by_agents is not None:
        tool.callable_by_agents = payload.callable_by_agents
    record_audit(
        db,
        user_id=user.id,
        action="tool.update",
        target_type="tool",
        target_id=tool.id,
        detail={
            "enabled": tool.enabled,
            "require_admin_approval": tool.require_admin_approval,
            "callable_by_agents": tool.callable_by_agents,
        },
    )
    db.commit()
    db.refresh(tool)
    return ToolRead.model_validate(tool)


@router.post("/execute")
def execute_tool(
    payload: ToolCallRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return ToolExecutor(db).execute(user, payload.agent_id, payload.tool_name, payload.payload)
