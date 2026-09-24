import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Switch } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, createAgent, fetchAgent, fetchKnowledgeBases, updateAgent } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { knowledgeBases } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";
import type { Agent, AgentPayload, AnswerMode, ToolItem } from "../types";

const fallbackTools: ToolItem[] = [
  { id: "kb_retrieval", name: "知识库检索工具", description: "知识库检索工具", permission_level: "user", enabled: true, require_admin_approval: false, callable_by_agents: true },
  { id: "web_search", name: "联网搜索工具", description: "联网搜索工具", permission_level: "user", enabled: true, require_admin_approval: false, callable_by_agents: true },
  { id: "excel_summary", name: "Excel 摘要分析工具", description: "Excel 摘要分析工具", permission_level: "admin", enabled: true, require_admin_approval: false, callable_by_agents: true },
  { id: "word_report", name: "Word 报告导出工具", description: "Word 报告导出工具", permission_level: "admin", enabled: true, require_admin_approval: false, callable_by_agents: true }
];

type AgentFormValues = {
  name: string;
  description?: string;
  role_prompt?: string;
  system_prompt?: string;
  welcome_message?: string;
  forbidden_rules?: string;
  answer_mode?: AnswerMode;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  context_window?: number;
  bound_knowledge_bases?: string[];
  bound_tools?: string[];
  output_format?: string;
  visibility?: string;
  enabled?: boolean;
};

function workflowFor(mode: AnswerMode) {
  return {
    steps: [
      { type: "input" },
      { type: "retrieve_kb", enabled: mode !== "web_only", top_k: 10 },
      { type: "web_search", enabled: mode !== "kb_only" },
      { type: "llm_generate" },
      { type: "format_output", format: "markdown" },
      { type: "final_output" }
    ]
  };
}

function toPayload(values: AgentFormValues, workflowConfig?: Record<string, unknown>): AgentPayload {
  const mode = (values.answer_mode || "kb_only") as AnswerMode;
  return {
    name: values.name,
    avatar: "RobotOutlined",
    description: values.description || "",
    role_prompt: values.role_prompt || "",
    system_prompt: values.system_prompt || "你是企业内部知识库智能体，必须遵守权限、引用和拒答规则。",
    welcome_message: values.welcome_message || `你好，我是${values.name}。请提出需要查询的问题。`,
    output_format: values.output_format || "markdown",
    forbidden_rules: values.forbidden_rules || "不得编造引用；不得跨知识库泄露；无依据必须拒答。",
    answer_mode: mode,
    model_config: {
      model: values.model || "qwen-dev",
      temperature: Number(values.temperature ?? 0.1),
      max_tokens: Number(values.max_tokens ?? 2048),
      context_window: Number(values.context_window ?? 8192)
    },
    bound_knowledge_bases: values.bound_knowledge_bases || [],
    bound_tools: values.bound_tools || [],
    workflow_config: workflowConfig || workflowFor(mode),
    visibility: values.visibility || "public_internal",
    enabled: values.enabled ?? true
  };
}

export function AgentEditorPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const agentId = params.get("id");
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [existingWorkflowConfig, setExistingWorkflowConfig] = useState<Record<string, unknown> | undefined>();
  const { data: kbs } = useApiData(fetchKnowledgeBases, knowledgeBases);
  const tools = useApiData<ToolItem[]>(async () => (await api.get("/tools")).data, fallbackTools);

  const kbOptions = useMemo(() => kbs.map((kb) => ({ value: kb.id, label: kb.name })), [kbs]);
  const toolOptions = useMemo(
    () => tools.data.filter((tool) => tool.enabled).map((tool) => ({ value: tool.id, label: tool.description || tool.name || tool.id })),
    [tools.data]
  );

  useEffect(() => {
    if (!agentId) return;
    fetchAgent(agentId).then((agent: Agent) => {
      const modelConfig = agent.model_config || {};
      setExistingWorkflowConfig(agent.workflow_config);
      form.setFieldsValue({
        name: agent.name,
        description: agent.description,
        role_prompt: agent.role_prompt,
        system_prompt: agent.system_prompt,
        welcome_message: agent.welcome_message,
        forbidden_rules: agent.forbidden_rules,
        answer_mode: agent.answer_mode || "kb_only",
        bound_knowledge_bases: agent.bound_knowledge_bases || [],
        bound_tools: agent.bound_tools || [],
        model: String(modelConfig.model || "qwen-dev"),
        temperature: Number(modelConfig.temperature ?? 0.1),
        max_tokens: Number(modelConfig.max_tokens ?? 2048),
        context_window: Number(modelConfig.context_window ?? 8192),
        output_format: agent.output_format || "markdown",
        visibility: agent.visibility || "public_internal",
        enabled: agent.enabled
      });
    });
  }, [agentId, form]);

  async function handleFinish(values: AgentFormValues) {
    setSaving(true);
    try {
      const payload = toPayload(values, agentId ? existingWorkflowConfig : undefined);
      if (agentId) {
        await updateAgent(agentId, payload);
      } else {
        await createAgent(payload);
      }
      navigate("/agents");
    } catch {
      message.error("保存失败，请确认账号权限和后端服务状态");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="智能体创建 / 编辑页" description="配置角色、回答模式、可用资料、工具权限和输出要求。" />
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ answer_mode: "kb_only", visibility: "public_internal", temperature: 0.1, max_tokens: 2048, context_window: 8192, enabled: true }}
          onFinish={handleFinish}
        >
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item label="智能体名称" name="name" rules={[{ required: true, message: "请输入智能体名称" }]}>
                <Input placeholder="制度问答助手" />
              </Form.Item>
              <Form.Item label="适用说明" name="description">
                <Input.TextArea rows={3} placeholder="说明这个智能体面向哪些问题和资料范围" />
              </Form.Item>
              <Form.Item label="角色设定" name="role_prompt">
                <Input.TextArea rows={4} placeholder="例如：专注企业制度解释，必须引用制度来源。" />
              </Form.Item>
              <Form.Item label="禁止事项" name="forbidden_rules">
                <Input.TextArea rows={4} placeholder="不得编造引用；不得跨知识库泄露；无依据必须拒答。" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item label="回答模式" name="answer_mode">
                <Select options={[{ value: "kb_only", label: "仅知识库" }, { value: "web_only", label: "联网检索" }, { value: "hybrid", label: "知识库 + 联网" }]} />
              </Form.Item>
              <Form.Item label="绑定知识库" name="bound_knowledge_bases">
                <Select mode="multiple" options={kbOptions} placeholder="选择这个智能体可使用的知识库" />
              </Form.Item>
              <Form.Item label="可用工具" name="bound_tools">
                <Select mode="multiple" options={toolOptions} placeholder="选择允许调用的工具" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="模型名称" name="model">
                    <Input placeholder="qwen-dev / qwen-prod" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="温度" name="temperature">
                    <InputNumber min={0} max={1} step={0.1} className="w-full" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="最大输出" name="max_tokens">
                    <InputNumber min={256} max={32768} className="w-full" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="上下文长度" name="context_window">
                    <InputNumber min={1024} max={131072} className="w-full" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="输出要求" name="output_format">
                <Input.TextArea rows={3} placeholder="Markdown；固定报告结构；表格摘要等" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="可见范围" name="visibility">
                    <Select options={[{ value: "private", label: "私有" }, { value: "team", label: "团队" }, { value: "public_internal", label: "内部公开" }]} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="启用状态" name="enabled" valuePropName="checked">
                    <Switch checkedChildren="启用" unCheckedChildren="停用" />
                  </Form.Item>
                </Col>
              </Row>
              <Space>
                <Button type="primary" htmlType="submit" loading={saving}>保存配置</Button>
                <Button onClick={() => navigate("/agents")}>取消</Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>
    </>
  );
}
