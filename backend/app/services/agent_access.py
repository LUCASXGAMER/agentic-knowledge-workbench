from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Agent, AgentAccess, User

ADMIN_ROLES = {"super_admin", "admin"}


def user_can_access_agent(db: Session, user: User, agent: Agent) -> bool:
    if user.role in ADMIN_ROLES:
        return True
    if not agent.enabled:
        return False
    if agent.created_by == user.id:
        return True
    if agent.visibility == "public_internal":
        return True
    grant = db.scalar(select(AgentAccess).where(AgentAccess.agent_id == agent.id, AgentAccess.user_id == user.id))
    return grant is not None


def list_accessible_agents(db: Session, user: User) -> list[Agent]:
    query = select(Agent).order_by(Agent.created_at.asc())
    if user.role in ADMIN_ROLES:
        return list(db.scalars(query).all())
    agents = db.scalars(query.where(Agent.enabled.is_(True))).all()
    return [agent for agent in agents if user_can_access_agent(db, user, agent)]
