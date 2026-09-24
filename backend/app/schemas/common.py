from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRead(OrmModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str = ""
    visibility: str = "team"
    chunking_strategy: str = "default_policy_clause"


class KnowledgeBaseRead(OrmModel):
    id: str
    name: str
    description: str
    owner_id: str | None
    visibility: str
    embedding_model: str
    chunking_strategy: str
    document_count: int
    chunk_count: int
    created_at: datetime
    updated_at: datetime


class DocumentRead(OrmModel):
    id: str
    kb_id: str
    file_name: str
    file_type: str
    status: str
    parse_message: str
    version: str
    page_count: int
    chunk_count: int
    created_at: datetime
    updated_at: datetime


class ChunkRead(OrmModel):
    id: str
    document_id: str
    kb_id: str
    file_name: str
    page: int | None
    section_title: str
    text: str
    source_type: str
    token_count: int
    version: str
    embedding_model: str
    created_at: datetime


class IndexJobRead(OrmModel):
    id: str
    kb_id: str
    status: str
    total_documents: int
    processed_documents: int
    chunk_count: int
    error_message: str
    created_by: str | None
    created_at: datetime
    updated_at: datetime


class AgentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    avatar: str = "RobotOutlined"
    description: str = ""
    role_prompt: str = ""
    system_prompt: str = ""
    welcome_message: str = ""
    output_format: str = "markdown"
    forbidden_rules: str = "不得编造引用；无依据必须拒答。"
    answer_mode: str = "kb_only"
    model_settings: dict[str, Any] = Field(default_factory=dict, alias="model_config")
    bound_knowledge_bases: list[str] = Field(default_factory=list)
    bound_tools: list[str] = Field(default_factory=list)
    workflow_config: dict[str, Any] = Field(default_factory=lambda: {"steps": []})
    visibility: str = "public_internal"
    enabled: bool = True


class AgentRead(OrmModel):
    id: str
    name: str
    avatar: str
    description: str
    role_prompt: str
    system_prompt: str
    welcome_message: str
    output_format: str
    forbidden_rules: str
    answer_mode: str
    visibility: str
    created_by: str | None
    enabled: bool
    created_at: datetime
    updated_at: datetime
    model_settings: dict[str, Any] = Field(default_factory=dict, alias="model_config")
    bound_knowledge_bases: list[str] = Field(default_factory=list)
    bound_tools: list[str] = Field(default_factory=list)
    workflow_config: dict[str, Any] = Field(default_factory=dict)


class AgentAccessRead(OrmModel):
    id: str
    agent_id: str
    user_id: str
    granted_by: str | None
    created_at: datetime
    user: UserRead | None = None


class AgentAccessUpdate(BaseModel):
    user_ids: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    agent_id: str
    question: str
    answer_mode: str | None = None


class Citation(BaseModel):
    file_name: str
    page: int | None = None
    section_title: str = ""
    chunk_text: str
    score: float
    source_type: str
    document_id: str
    chunk_id: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    trace: list[dict[str, Any]]
    refused: bool
    answer_mode: str
    model: str
    latency_ms: int
    qa_log_id: str | None = None


class FeedbackRequest(BaseModel):
    rating: str
    comment: str = ""


class ToolRead(OrmModel):
    id: str
    name: str
    description: str
    enabled: bool
    permission_level: str
    require_admin_approval: bool
    callable_by_agents: bool
    created_at: datetime
    updated_at: datetime


class HealthResponse(BaseModel):
    status: str
    app: str
    app_env: str
    deploy_profile: str
    database: str
    llm_provider: str
    use_mock_llm: bool
    embedding_model: str
    vector_store_provider: str
    web_search_enabled: bool
    qdrant_url: str
