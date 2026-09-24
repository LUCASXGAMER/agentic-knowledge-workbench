from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import Base, engine
from app.models.entities import Agent, KnowledgeBase, Tool, User


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


def seed_defaults(db: Session) -> None:
    settings = get_settings()
    admin = db.scalar(select(User).where(User.email == settings.admin_email))
    if not admin:
        admin = User(
            email=settings.admin_email,
            full_name="默认管理员",
            hashed_password=hash_password(settings.admin_password),
            role="super_admin",
        )
        db.add(admin)
        db.flush()

    normal_user = db.scalar(select(User).where(User.email == "user@example.com"))
    if not normal_user:
        normal_user = User(
            email="user@example.com",
            full_name="普通员工",
            hashed_password=hash_password("User123456!"),
            role="user",
        )
        db.add(normal_user)
    else:
        if normal_user.full_name == "演示普通用户":
            normal_user.full_name = "普通员工"

    kb_defs = [
        ("制度库", "员工考勤、报销、信息安全等制度。"),
        ("合同库", "合同条款、审查清单与风险提示。"),
        ("技术库", "部署、接口、运维和故障排查资料。"),
        ("项目库", "项目会议纪要、计划与交付材料。"),
        ("会议纪要库", "会议议题、决议、责任人和时间节点。"),
    ]
    kb_ids: list[str] = []
    for name, desc in kb_defs:
        kb = db.scalar(select(KnowledgeBase).where(KnowledgeBase.name == name))
        if not kb:
            kb = KnowledgeBase(
                name=name,
                description=desc,
                owner_id=admin.id,
                embedding_model=settings.embedding_model_name,
            )
            db.add(kb)
            db.flush()
        kb_ids.append(kb.id)

    tool_defs = [
        ("kb_retrieval", "知识库检索工具", "user", True, False),
        ("web_search", "联网搜索工具，未配置时会降级提示", "user", True, False),
        ("excel_summary", "Excel 摘要分析工具", "admin", True, False),
        ("word_report", "Word 报告导出工具", "admin", True, False),
        ("ppt_generator", "PPT 生成工具，需审批后启用", "admin", False, True),
        ("local_python_script", "本地 Python 脚本工具，默认禁用", "super_admin", False, True),
        ("database_query", "数据库查询工具，需审批后启用", "super_admin", False, True),
        ("internal_api", "内部系统 API 调用工具，需审批后启用", "admin", False, True),
    ]
    for tool_id, desc, level, enabled, approval in tool_defs:
        tool = db.get(Tool, tool_id)
        if not tool:
            db.add(
                Tool(
                    id=tool_id,
                    name=tool_id,
                    description=desc,
                    permission_level=level,
                    enabled=enabled,
                    require_admin_approval=approval,
                    callable_by_agents=enabled,
                    input_schema_json=json.dumps({"type": "object"}, ensure_ascii=False),
                    output_schema_json=json.dumps({"type": "object"}, ensure_ascii=False),
                )
            )
        else:
            tool.description = desc
            tool.permission_level = level

    agent_defs = [
        ("制度问答助手", "只根据制度库回答，必须引用制度来源。", "kb_only", [kb_ids[0]], ["kb_retrieval"]),
        ("合同审查助手", "引用合同条款，只给风险提示，不给法律最终结论。", "kb_only", [kb_ids[1]], ["kb_retrieval"]),
        ("报告生成助手", "根据会议纪要和项目资料生成固定格式报告。", "kb_only", [kb_ids[3], kb_ids[4]], ["kb_retrieval", "word_report"]),
        ("技术文档助手", "解释技术文档和部署问题。", "kb_only", [kb_ids[2]], ["kb_retrieval"]),
        ("Excel 分析助手", "分析表格并输出统计摘要。", "kb_only", [kb_ids[3]], ["excel_summary"]),
        ("联网研究助手", "仅使用互联网来源，清楚标注外部来源。", "web_only", [], ["web_search"]),
        ("混合资料分析助手", "优先使用知识库，互联网仅作为补充。", "hybrid", kb_ids[:3], ["kb_retrieval", "web_search"]),
    ]
    for name, desc, mode, bound_kbs, tools in agent_defs:
        agent = db.scalar(select(Agent).where(Agent.name == name))
        if not agent:
            db.add(
                Agent(
                    name=name,
                    description=desc,
                    role_prompt=desc,
                    system_prompt="你是企业内部知识库智能体，必须优先遵守权限、引用和拒答规则。",
                    welcome_message=f"你好，我是{name}。请提出需要查询的问题。",
                    output_format="markdown",
                    forbidden_rules="不得编造引用；不得跨知识库泄露；无依据必须拒答。",
                    answer_mode=mode,
                    model_config_json=json.dumps(
                        {
                            "provider": settings.llm_provider,
                            "model": settings.llm_model,
                            "temperature": settings.llm_temperature,
                            "max_tokens": settings.llm_max_tokens,
                            "context_window": 8192,
                        },
                        ensure_ascii=False,
                    ),
                    bound_knowledge_bases_json=json.dumps(bound_kbs, ensure_ascii=False),
                    bound_tools_json=json.dumps(tools, ensure_ascii=False),
                    workflow_config_json=json.dumps(
                        {
                            "steps": [
                                {"type": "input"},
                                {"type": "retrieve_kb", "top_k": 10, "enabled": mode != "web_only"},
                                {"type": "web_search", "enabled": mode in {"web_only", "hybrid"}},
                                {"type": "llm_generate"},
                                {"type": "format_output", "format": "markdown"},
                                {"type": "final_output"},
                            ]
                        },
                        ensure_ascii=False,
                    ),
                    created_by=admin.id,
                )
            )

    db.commit()

    for path in [
        settings.upload_dir,
        settings.parsed_dir,
        settings.vector_db_dir,
        Path(settings.sqlite_path).parent,
        settings.log_dir,
    ]:
        Path(path).mkdir(parents=True, exist_ok=True)
