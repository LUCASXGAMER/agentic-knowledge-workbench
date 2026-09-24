from __future__ import annotations

import time
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import Tool, ToolCallLog, User


class ToolExecutionError(RuntimeError):
    pass


class ToolExecutor:
    def __init__(self, db: Session):
        self.db = db

    def execute(self, user: User, agent_id: str | None, tool_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        started = time.perf_counter()
        tool = self.db.get(Tool, tool_name)
        try:
            if not tool:
                raise ToolExecutionError("工具不存在。")
            if not tool.enabled or not tool.callable_by_agents:
                raise ToolExecutionError("该工具未启用或不允许智能体调用。")
            if not self._role_can_call(user.role, tool.permission_level):
                raise ToolExecutionError("当前账号无权调用该工具。")
            if tool.require_admin_approval:
                raise ToolExecutionError("该工具需要管理员审批后才能调用。")
            if tool_name == "excel_summary":
                output = self._excel_summary(payload)
            elif tool_name == "word_report":
                output = self._word_report(payload)
            elif tool_name == "web_search":
                output = {"message": "联网搜索由 SearchProvider 统一处理。"}
            elif tool_name == "kb_retrieval":
                output = {"message": "知识库检索由 RAG Pipeline 统一处理。"}
            else:
                raise ToolExecutionError("该工具属于受控能力，启用前需要管理员审批。")
            status = "success"
            error = ""
        except Exception as exc:
            output = {"error": str(exc)}
            status = "failed"
            error = str(exc)
        latency_ms = int((time.perf_counter() - started) * 1000)
        self.db.add(
                ToolCallLog(
                    user_id=user.id,
                    agent_id=agent_id,
                    tool_id=tool_name,
                tool_name=tool_name,
                input_json=str(payload),
                output_json=str(output),
                status=status,
                error_message=error,
                latency_ms=latency_ms,
            )
        )
        self.db.commit()
        return output

    def _role_can_call(self, user_role: str, permission_level: str) -> bool:
        rank = {"user": 1, "admin": 2, "super_admin": 3}
        return rank.get(user_role, 0) >= rank.get(permission_level, 3)

    def _excel_summary(self, payload: dict[str, Any]) -> dict[str, Any]:
        rows = payload.get("rows") or []
        return {"row_count": len(rows), "columns": sorted({key for row in rows for key in row.keys()})}

    def _word_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = payload.get("title", "企业知识库报告")
        return {"title": title, "status": "generated", "message": "报告内容已生成，可由管理员导出归档。"}
