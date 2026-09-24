from fastapi.testclient import TestClient

from app.main import app


def _login(client: TestClient) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123!"})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _login_user(client: TestClient) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": "user@example.com", "password": "User123456!"})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_documents_and_model_settings_are_available():
    with TestClient(app) as client:
        headers = _login(client)
        dashboard = client.get("/api/dashboard", headers=headers)
        assert dashboard.status_code == 200, dashboard.text
        assert "metrics" in dashboard.json()
        assert "system_status" in dashboard.json()

        documents = client.get("/api/documents", headers=headers)
        assert documents.status_code == 200, documents.text
        assert isinstance(documents.json(), list)

        settings = client.get("/api/settings/model", headers=headers)
        assert settings.status_code == 200, settings.text
        assert settings.json()["deploy_profile"]

        eval_run = client.post("/api/eval/sample", headers=headers)
        assert eval_run.status_code == 200, eval_run.text
        eval_runs = client.get("/api/eval/runs", headers=headers)
        assert eval_runs.status_code == 200, eval_runs.text
        assert isinstance(eval_runs.json()[0]["metrics"], dict)


def test_admin_can_create_kb_agent_and_upload_document():
    with TestClient(app) as client:
        headers = _login(client)
        kb_response = client.post(
            "/api/knowledge-bases",
            headers=headers,
            json={"name": "自动化测试知识库", "description": "用于接口闭环测试", "visibility": "team"},
        )
        assert kb_response.status_code == 200, kb_response.text
        kb_id = kb_response.json()["id"]

        duplicate_kb = client.post(
            "/api/knowledge-bases",
            headers=headers,
            json={"name": " 自动化测试知识库 ", "description": "重复名称应被拦截", "visibility": "team"},
        )
        assert duplicate_kb.status_code == 409, duplicate_kb.text

        agent_response = client.post(
            "/api/agents",
            headers=headers,
            json={
                "name": "自动化测试助手",
                "description": "用于验证智能体保存",
                "role_prompt": "只回答测试知识库中的内容。",
                "answer_mode": "kb_only",
                "bound_knowledge_bases": [kb_id],
                "bound_tools": ["kb_retrieval"],
                "model_config": {"model": "qwen-dev", "temperature": 0.1, "max_tokens": 1024},
            },
        )
        assert agent_response.status_code == 200, agent_response.text
        assert agent_response.json()["bound_knowledge_bases"] == [kb_id]

        duplicate_agent = client.post(
            "/api/agents",
            headers=headers,
            json={
                "name": " 自动化测试助手 ",
                "description": "重复名称应被拦截",
                "answer_mode": "kb_only",
                "bound_knowledge_bases": [kb_id],
                "bound_tools": ["kb_retrieval"],
            },
        )
        assert duplicate_agent.status_code == 409, duplicate_agent.text

        files = {"file": ("测试制度.txt", "员工请假需要提前提交申请，并由直属负责人审批。".encode("utf-8"), "text/plain")}
        upload_response = client.post(f"/api/documents/upload/{kb_id}", headers=headers, files=files)
        assert upload_response.status_code == 200, upload_response.text
        document = upload_response.json()
        assert document["file_name"] == "测试制度.txt"
        assert document["status"] == "parsed"
        assert document["chunk_count"] >= 1

        chunks = client.get(f"/api/knowledge-bases/{kb_id}/chunks", headers=headers)
        assert chunks.status_code == 200, chunks.text
        assert chunks.json()[0]["file_name"] == "测试制度.txt"

        rebuild = client.post(f"/api/knowledge-bases/{kb_id}/rebuild", headers=headers)
        assert rebuild.status_code == 200, rebuild.text
        assert rebuild.json()["kb_id"] == kb_id
        assert rebuild.json()["total_documents"] == 1

        rebuild_jobs = client.get(f"/api/knowledge-bases/{kb_id}/rebuild-jobs", headers=headers)
        assert rebuild_jobs.status_code == 200, rebuild_jobs.text
        assert rebuild_jobs.json()[0]["status"] in {"queued", "running", "success"}
        assert rebuild_jobs.json()[0]["total_documents"] == 1

        workflow = client.post("/api/workflows/run", headers=headers, json={"agent_id": agent_response.json()["id"]})
        assert workflow.status_code == 200, workflow.text
        assert workflow.json()["status"] == "success"
        assert workflow.json()["trace"]


def test_chat_feedback_and_tool_permission_flow():
    with TestClient(app) as client:
        headers = _login(client)
        agents = client.get("/api/agents", headers=headers)
        assert agents.status_code == 200, agents.text
        agent_id = agents.json()[0]["id"]

        chat = client.post(
            "/api/chat",
            headers=headers,
            json={"agent_id": agent_id, "question": "公司股票明天会涨吗？", "answer_mode": "kb_only"},
        )
        assert chat.status_code == 200, chat.text
        payload = chat.json()
        assert payload["qa_log_id"]
        assert payload["answer"]

        feedback = client.post(
            f"/api/chat/{payload['qa_log_id']}/feedback",
            headers=headers,
            json={"rating": "useful", "comment": "拒答符合预期"},
        )
        assert feedback.status_code == 200, feedback.text
        assert feedback.json()["status"] == "saved"

        tool = client.post(
            "/api/tools/execute",
            headers=headers,
            json={"tool_name": "excel_summary", "payload": {"rows": [{"部门": "研发部", "金额": 3200}]}},
        )
        assert tool.status_code == 200, tool.text
        assert tool.json()["row_count"] == 1

        update_tool = client.put("/api/tools/web_search", headers=headers, json={"enabled": True, "callable_by_agents": True})
        assert update_tool.status_code == 200, update_tool.text
        assert update_tool.json()["enabled"] is True


def test_user_management_and_role_boundaries():
    with TestClient(app) as client:
        user_headers = _login_user(client)
        forbidden_users = client.get("/api/users", headers=user_headers)
        assert forbidden_users.status_code == 403
        forbidden_kb_list = client.get("/api/knowledge-bases", headers=user_headers)
        assert forbidden_kb_list.status_code == 403
        forbidden_docs = client.get("/api/documents", headers=user_headers)
        assert forbidden_docs.status_code == 403
        forbidden_tools = client.get("/api/tools", headers=user_headers)
        assert forbidden_tools.status_code == 403
        forbidden_kb = client.post("/api/knowledge-bases", headers=user_headers, json={"name": "普通用户不可创建"})
        assert forbidden_kb.status_code == 403

        admin_headers = _login(client)
        create = client.post(
            "/api/users",
            headers=admin_headers,
            json={"email": "created.by.test@example.com", "full_name": "测试创建用户", "password": "User123456!", "role": "user"},
        )
        assert create.status_code in {200, 409}, create.text


def test_agent_access_grants_protect_private_agents():
    with TestClient(app) as client:
        admin_headers = _login(client)
        user_headers = _login_user(client)

        private_agent = client.post(
            "/api/agents",
            headers=admin_headers,
            json={
                "name": "私有授权测试助手",
                "description": "只允许被授权用户使用",
                "role_prompt": "用于验证智能体授权。",
                "answer_mode": "kb_only",
                "visibility": "private",
                "bound_knowledge_bases": [],
                "bound_tools": ["kb_retrieval"],
                "model_config": {"model": "qwen-dev", "temperature": 0.1, "max_tokens": 512},
            },
        )
        assert private_agent.status_code == 200, private_agent.text
        agent_id = private_agent.json()["id"]

        user_agents = client.get("/api/agents", headers=user_headers)
        assert user_agents.status_code == 200, user_agents.text
        assert agent_id not in {item["id"] for item in user_agents.json()}

        forbidden_chat = client.post(
            "/api/chat",
            headers=user_headers,
            json={"agent_id": agent_id, "question": "这个私有智能体可以用吗？"},
        )
        assert forbidden_chat.status_code == 403

        users = client.get("/api/users", headers=admin_headers)
        assert users.status_code == 200, users.text
        normal_user_id = next(item["id"] for item in users.json() if item["email"] == "user@example.com")

        grant = client.put(f"/api/agents/{agent_id}/access", headers=admin_headers, json={"user_ids": [normal_user_id]})
        assert grant.status_code == 200, grant.text
        assert grant.json()[0]["user_id"] == normal_user_id

        user_agents_after_grant = client.get("/api/agents", headers=user_headers)
        assert user_agents_after_grant.status_code == 200, user_agents_after_grant.text
        assert agent_id in {item["id"] for item in user_agents_after_grant.json()}
