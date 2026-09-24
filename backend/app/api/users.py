from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.entities import User
from app.schemas.common import UserRead
from app.services.audit import record_audit

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    email: str
    full_name: str = ""
    password: str = "User123456!"
    role: str = "user"


@router.get("", response_model=list[UserRead])
def list_users(
    _: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> list[UserRead]:
    return [UserRead.model_validate(item) for item in db.scalars(select(User).order_by(User.created_at.desc())).all()]


@router.post("", response_model=UserRead)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> UserRead:
    if payload.role not in {"super_admin", "admin", "user"}:
        raise HTTPException(status_code=400, detail="角色不合法")
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=409, detail="邮箱已存在")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    record_audit(
        db,
        user_id=current_user.id,
        action="user.create",
        target_type="user",
        target_id=user.id,
        detail={"email": user.email, "role": user.role},
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)
