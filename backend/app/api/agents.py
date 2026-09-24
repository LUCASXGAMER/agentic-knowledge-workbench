from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.entities import Agent, AgentAccess, User
from app.schemas.common import AgentAccessRead, AgentAccessUpdate, AgentCreate, AgentRead, UserRead
from app.services.audit import record_audit
from app.services.agent_access import list_accessible_agents, user_can_access_agent
from app.services.json_helpers import dumps, loads

router = APIRouter(prefix="/api/agents", tags=["agents"])


def default_workflow(answer_mode: str) -> dict:
    return {
        "steps": [
            {"type": "input"},
            {"type": "retrieve_kb", "top_k": 10, "enabled": answer_mode != "web_only"},
            {"type": "web_search", "enabled": answer_mode in {"web_only", "hybrid"}},
            {"type": "llm_generate"},
            {"type": "format_output", "format": "markdown"},
            {"type": "final_output"},
        ]
    }


def workflow_or_default(payload: AgentCreate) -> dict:
    steps = payload.workflow_config.get("steps") if isinstance(payload.workflow_config, dict) else None
    return payload.workflow_config if steps else default_workflow(payload.answer_mode)


def serialize_agent(agent: Agent) -> AgentRead:
    data = AgentRead.model_validate(agent)
    data.model_settings = loads(agent.model_config_json, {})
    data.bound_knowledge_bases = loads(agent.bound_knowledge_bases_json, [])
    data.bound_tools = loads(agent.bound_tools_json, [])
    data.workflow_config = loads(agent.workflow_config_json, {})
    return data


def normalize_agent_name(name: str) -> str:
    return " ".join(name.strip().split())


def ensure_unique_agent_name(db: Session, name: str, current_agent_id: str | None = None) -> str:
    normalized = normalize_agent_name(name)
    if not normalized:
        raise HTTPException(status_code=400, detail="智能体名称不能为空")
    query = select(Agent).where(func.lower(Agent.name) == normalized.lower())
    if current_agent_id:
        query = query.where(Agent.id != current_agent_id)
    if db.scalar(query):
        raise HTTPException(status_code=409, detail="已存在同名智能体，请使用不同名称")
    return normalized


@router.get("", response_model=list[AgentRead])
def list_agents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AgentRead]:
    return [serialize_agent(item) for item in list_accessible_agents(db, user)]


@router.post("", response_model=AgentRead)
def create_agent(
    payload: AgentCreate,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> AgentRead:
    agent_name = ensure_unique_agent_name(db, payload.name)
    agent = Agent(
        name=agent_name,
        avatar=payload.avatar,
        description=payload.description,
        role_prompt=payload.role_prompt,
        system_prompt=payload.system_prompt,
        welcome_message=payload.welcome_message,
        output_format=payload.output_format,
        forbidden_rules=payload.forbidden_rules,
        answer_mode=payload.answer_mode,
        model_config_json=dumps(payload.model_settings),
        bound_knowledge_bases_json=dumps(payload.bound_knowledge_bases),
        bound_tools_json=dumps(payload.bound_tools),
        workflow_config_json=dumps(workflow_or_default(payload)),
        visibility=payload.visibility,
        enabled=payload.enabled,
        created_by=user.id,
    )
    db.add(agent)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="agent.create",
        target_type="agent",
        target_id=agent.id,
        detail={"name": agent.name, "answer_mode": agent.answer_mode},
    )
    db.commit()
    db.refresh(agent)
    return serialize_agent(agent)


@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentRead:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="智能体不存在")
    if not user_can_access_agent(db, user, agent):
        raise HTTPException(status_code=403, detail="当前账号未授权使用该智能体")
    return serialize_agent(agent)


@router.put("/{agent_id}", response_model=AgentRead)
def update_agent(
    agent_id: str,
    payload: AgentCreate,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> AgentRead:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="智能体不存在")
    agent_name = ensure_unique_agent_name(db, payload.name, current_agent_id=agent_id)
    for field in [
        "avatar",
        "description",
        "role_prompt",
        "system_prompt",
        "welcome_message",
        "output_format",
        "forbidden_rules",
        "answer_mode",
        "visibility",
        "enabled",
    ]:
        setattr(agent, field, getattr(payload, field))
    agent.name = agent_name
    agent.model_config_json = dumps(payload.model_settings)
    agent.bound_knowledge_bases_json = dumps(payload.bound_knowledge_bases)
    agent.bound_tools_json = dumps(payload.bound_tools)
    agent.workflow_config_json = dumps(workflow_or_default(payload))
    record_audit(
        db,
        user_id=user.id,
        action="agent.update",
        target_type="agent",
        target_id=agent.id,
        detail={"name": agent.name, "answer_mode": agent.answer_mode, "enabled": agent.enabled},
    )
    db.commit()
    db.refresh(agent)
    return serialize_agent(agent)


def serialize_agent_access(db: Session, access: AgentAccess) -> AgentAccessRead:
    data = AgentAccessRead.model_validate(access)
    user = db.get(User, access.user_id)
    data.user = UserRead.model_validate(user) if user else None
    return data


@router.get("/{agent_id}/access", response_model=list[AgentAccessRead])
def list_agent_access(
    agent_id: str,
    _: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[AgentAccessRead]:
    if not db.get(Agent, agent_id):
        raise HTTPException(status_code=404, detail="智能体不存在")
    rows = db.scalars(select(AgentAccess).where(AgentAccess.agent_id == agent_id).order_by(AgentAccess.created_at.desc())).all()
    return [serialize_agent_access(db, row) for row in rows]


@router.put("/{agent_id}/access", response_model=list[AgentAccessRead])
def update_agent_access(
    agent_id: str,
    payload: AgentAccessUpdate,
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[AgentAccessRead]:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="智能体不存在")

    user_ids = sorted(set(payload.user_ids))
    if user_ids:
        existing_users = db.scalars(
            select(User).where(User.id.in_(user_ids), User.is_active.is_(True), User.role == "user")
        ).all()
        existing_ids = {item.id for item in existing_users}
        if existing_ids != set(user_ids):
            raise HTTPException(status_code=400, detail="授权列表包含不存在或不可授权的用户")

    db.execute(delete(AgentAccess).where(AgentAccess.agent_id == agent_id))
    for target_user_id in user_ids:
        db.add(AgentAccess(agent_id=agent_id, user_id=target_user_id, granted_by=user.id))
    record_audit(
        db,
        user_id=user.id,
        action="agent.access_update",
        target_type="agent",
        target_id=agent.id,
        detail={"name": agent.name, "user_count": len(user_ids)},
    )
    db.commit()
    rows = db.scalars(select(AgentAccess).where(AgentAccess.agent_id == agent_id).order_by(AgentAccess.created_at.desc())).all()
    return [serialize_agent_access(db, row) for row in rows]
