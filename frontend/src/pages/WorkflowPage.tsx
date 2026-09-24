import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  SaveOutlined,
  StopOutlined,
  UpOutlined
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Timeline,
  Typography
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchAgents, runWorkflow, updateAgent } from "../api/client";
import { ModeTag } from "../components/ModeTag";
import { PageHeader } from "../components/PageHeader";
import { agents as fallbackAgents } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";
import type { Agent, AgentPayload, AnswerMode, WorkflowRunResult, WorkflowTraceStep } from "../types";

type WorkflowStepType =
  | "input"
  | "retrieve_kb"
  | "web_search"
  | "tool_call"
  | "llm_generate"
  | "format_output"
  | "human_review"
  | "final_output";

type WorkflowStepDraft = {
  id: string;
  type: WorkflowStepType;
  title: string;
  description: string;
  enabled: boolean;
  top_k?: number;
  format?: string;
  required?: boolean;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  scene: string;
  owner: string;
  description: string;
  steps: WorkflowStepDraft[];
};

const stepTypeOptions: Array<{ value: WorkflowStepType; label: string }> = [
  { value: "input", label: "需求登记" },
  { value: "retrieve_kb", label: "知识库检索" },
  { value: "web_search", label: "联网检索" },
  { value: "tool_call", label: "工具调用" },
  { value: "llm_generate", label: "模型生成" },
  { value: "format_output", label: "格式整理" },
  { value: "human_review", label: "人工复核" },
  { value: "final_output", label: "结果交付" }
];

const stepTitles: Record<WorkflowStepType | string, string> = {
  input: "需求登记",
  retrieve_kb: "知识库检索",
  web_search: "联网检索",
  tool_call: "工具调用",
  llm_generate: "模型生成",
  format_output: "格式整理",
  human_review: "人工复核",
  final_output: "结果交付"
};

const stepDescriptions: Record<WorkflowStepType, string> = {
  input: "记录用户问题、智能体、回答模式和权限范围",
  retrieve_kb: "在绑定知识库中召回候选片段并保留引用元数据",
  web_search: "仅在联网或混合模式下补充外部资料",
  tool_call: "调用已授权工具，例如 Excel 分析或 Word 报告导出",
  llm_generate: "基于资料、工具结果和约束生成回答草稿",
  format_output: "按智能体输出格式整理答案、报告或表格",
  human_review: "重要内容进入人工确认或复核队列",
  final_output: "返回答案、引用、执行记录和用户反馈入口"
};

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "policy_qa",
    name: "制度问答流程",
    scene: "制度、流程、规范类问答",
    owner: "制度问答助手",
    description: "只走内部知识库，适合考勤、报销、信息安全等制度解释。",
    steps: [
      createStep("input"),
      createStep("retrieve_kb", { top_k: 10 }),
      createStep("llm_generate"),
      createStep("format_output", { format: "markdown_with_citations" }),
      createStep("final_output")
    ]
  },
  {
    id: "contract_review",
    name: "合同审查流程",
    scene: "合同条款风险提示",
    owner: "合同审查助手",
    description: "检索合同库与审查规则，输出风险分级，并保留人工复核环节。",
    steps: [
      createStep("input"),
      createStep("retrieve_kb", { top_k: 12 }),
      createStep("llm_generate"),
      createStep("format_output", { format: "risk_review_table" }),
      createStep("human_review", { required: true }),
      createStep("final_output")
    ]
  },
  {
    id: "report_generation",
    name: "报告生成流程",
    scene: "会议纪要、项目材料汇总",
    owner: "报告生成助手",
    description: "检索项目资料，调用文档工具，生成结构化报告草稿。",
    steps: [
      createStep("input"),
      createStep("retrieve_kb", { top_k: 16 }),
      createStep("tool_call"),
      createStep("llm_generate"),
      createStep("format_output", { format: "markdown_report" }),
      createStep("human_review", { required: false }),
      createStep("final_output")
    ]
  },
  {
    id: "excel_analysis",
    name: "Excel 分析流程",
    scene: "费用、设备、统计表分析",
    owner: "Excel 分析助手",
    description: "优先调用 Excel 摘要工具，再把统计结果整理成可阅读结论。",
    steps: [
      createStep("input"),
      createStep("tool_call"),
      createStep("llm_generate"),
      createStep("format_output", { format: "analysis_summary" }),
      createStep("final_output")
    ]
  },
  {
    id: "hybrid_research",
    name: "混合资料分析流程",
    scene: "内部资料优先，外部信息补充",
    owner: "混合资料分析助手",
    description: "内部知识库优先，联网信息只作为补充，并在结果中区分来源。",
    steps: [
      createStep("input"),
      createStep("retrieve_kb", { top_k: 10 }),
      createStep("web_search"),
      createStep("llm_generate"),
      createStep("format_output", { format: "source_separated_report" }),
      createStep("final_output")
    ]
  }
];

function createStep(type: WorkflowStepType, overrides: Partial<WorkflowStepDraft> = {}): WorkflowStepDraft {
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title: stepTitles[type],
    description: stepDescriptions[type],
    enabled: true,
    ...overrides
  };
}

function modeOf(agent?: Agent): AnswerMode {
  return (agent?.answer_mode || agent?.answerMode || "kb_only") as AnswerMode;
}

function templateForAgent(agent?: Agent) {
  if (!agent) return workflowTemplates[0];
  const name = agent.name;
  const mode = modeOf(agent);
  if (name.includes("合同")) return workflowTemplates[1];
  if (name.includes("报告")) return workflowTemplates[2];
  if (name.includes("Excel")) return workflowTemplates[3];
  if (mode === "hybrid" || name.includes("混合")) return workflowTemplates[4];
  return workflowTemplates[0];
}

function normalizeSteps(agent?: Agent): WorkflowStepDraft[] {
  const rawSteps = Array.isArray(agent?.workflow_config?.steps) ? agent?.workflow_config?.steps : [];
  if (!rawSteps.length) return templateForAgent(agent).steps.map((step) => ({ ...step, id: `${step.type}-${Math.random().toString(36).slice(2, 9)}` }));
  return rawSteps.map((raw, index) => {
    const record = raw as Record<string, unknown>;
    const type = (record.type as WorkflowStepType) || "input";
    return {
      id: `${type}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      title: String(record.title || stepTitles[type] || type),
      description: String(record.description || stepDescriptions[type] || "执行当前步骤"),
      enabled: record.enabled !== false,
      top_k: typeof record.top_k === "number" ? record.top_k : undefined,
      format: typeof record.format === "string" ? record.format : undefined,
      required: typeof record.required === "boolean" ? record.required : undefined
    };
  });
}

function toWorkflowConfig(steps: WorkflowStepDraft[]) {
  return {
    steps: steps.map((step) => ({
      type: step.type,
      title: step.title,
      description: step.description,
      enabled: step.enabled,
      ...(step.top_k ? { top_k: step.top_k } : {}),
      ...(step.format ? { format: step.format } : {}),
      ...(typeof step.required === "boolean" ? { required: step.required } : {})
    }))
  };
}

function agentToPayload(agent: Agent, workflowConfig: Record<string, unknown>): AgentPayload {
  return {
    name: agent.name,
    avatar: agent.avatar || "RobotOutlined",
    description: agent.description || "",
    role_prompt: agent.role_prompt || "",
    system_prompt: agent.system_prompt || "你是企业内部知识库智能体，必须遵守权限、引用和拒答规则。",
    welcome_message: agent.welcome_message || `你好，我是${agent.name}。请提出需要查询的问题。`,
    output_format: agent.output_format || "markdown",
    forbidden_rules: agent.forbidden_rules || "不得编造引用；不得跨知识库泄露；无依据必须拒答。",
    answer_mode: modeOf(agent),
    model_config: agent.model_config || {},
    bound_knowledge_bases: agent.bound_knowledge_bases || agent.kbs || [],
    bound_tools: agent.bound_tools || agent.tools || [],
    workflow_config: workflowConfig,
    visibility: agent.visibility || "public_internal",
    enabled: agent.enabled
  };
}

function traceToTimeline(trace: WorkflowTraceStep[]) {
  return trace.map((item) => ({
    icon: item.status === "success" ? <CheckCircleOutlined /> : item.status === "skipped" ? <StopOutlined /> : <ClockCircleOutlined />,
    color: item.status === "success" ? "green" : item.status === "skipped" ? "gray" : "red",
    content: `${stepTitles[item.type] || item.type}：${item.message || item.status}`
  }));
}

function enabledCount(steps: WorkflowStepDraft[]) {
  return steps.filter((step) => step.enabled).length;
}

export function WorkflowPage() {
  const { message } = App.useApp();
  const { data: agentList, reload } = useApiData(fetchAgents, fallbackAgents);
  const [activeAgentId, setActiveAgentId] = useState("");
  const [steps, setSteps] = useState<WorkflowStepDraft[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(workflowTemplates[0].id);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<WorkflowRunResult | null>(null);

  const activeAgent = useMemo(() => {
    const id = activeAgentId || agentList[0]?.id;
    return agentList.find((item) => item.id === id) || agentList[0];
  }, [activeAgentId, agentList]);

  useEffect(() => {
    if (!activeAgent) return;
    const nextTemplate = templateForAgent(activeAgent);
    setSelectedTemplateId(nextTemplate.id);
    setSteps(normalizeSteps(activeAgent));
    setResult(null);
  }, [activeAgent?.id]);

  const currentConfig = useMemo(() => toWorkflowConfig(steps), [steps]);
  const activeTemplate = workflowTemplates.find((template) => template.id === selectedTemplateId) || workflowTemplates[0];

  function patchStep(id: string, patch: Partial<WorkflowStepDraft>) {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function applyTemplate(templateId: string) {
    const template = workflowTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setSteps(template.steps.map((step) => ({ ...step, id: `${step.type}-${Math.random().toString(36).slice(2, 9)}` })));
    setResult(null);
  }

  function addStep() {
    setSteps((current) => [...current, createStep("tool_call")]);
  }

  async function handleSave() {
    if (!activeAgent) return;
    setSaving(true);
    try {
      await updateAgent(activeAgent.id, agentToPayload(activeAgent, currentConfig));
      await reload();
      message.success("工作流已保存到当前智能体");
    } catch {
      message.error("保存失败，请确认账号权限和后端服务状态");
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!activeAgent) return;
    setRunning(true);
    try {
      const response = await runWorkflow(activeAgent.id, currentConfig);
      setResult(response);
    } catch {
      message.error("运行失败，请确认账号权限和后端服务状态");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="智能体工作流配置页"
        description="把固定业务流程绑定到智能体背后，员工仍然从智能体对话入口使用。"
        extra={
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={addStep}>添加步骤</Button>
            <Button icon={<SaveOutlined />} type="primary" loading={saving} onClick={handleSave}>保存到智能体</Button>
            <Button loading={running} onClick={handleRun}>试运行</Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} lg={6}>
          <Card className="prototype-metric-card">
            <Typography.Text type="secondary">当前智能体</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2">{activeAgent?.name || "-"}</Typography.Title>
            <Space wrap>
              {activeAgent && <ModeTag mode={modeOf(activeAgent)} />}
              <Tag color="cyan">{enabledCount(steps)} 个启用步骤</Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card className="prototype-metric-card">
            <Typography.Text type="secondary">绑定知识库</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2">{(activeAgent?.bound_knowledge_bases || activeAgent?.kbs || []).length}</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#12a89d]">按智能体授权检索</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card className="prototype-metric-card">
            <Typography.Text type="secondary">可用工具</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2">{(activeAgent?.bound_tools || activeAgent?.tools || []).length}</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#12a89d]">统一工具执行器</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card className="prototype-metric-card">
            <Typography.Text type="secondary">员工入口</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2">对话页</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#2867e8]">无需单独学习工作流</Typography.Text>
          </Card>
        </Col>
      </Row>

      <div className="prototype-workflow-studio">
        <div className="grid gap-4">
          <Card title="绑定对象">
            <Form layout="vertical">
              <Form.Item label="选择智能体">
                <Select
                  value={activeAgent?.id}
                  options={agentList.map((agent) => ({ value: agent.id, label: agent.name }))}
                  onChange={setActiveAgentId}
                />
              </Form.Item>
              <Form.Item label="流程模板">
                <Select
                  value={selectedTemplateId}
                  options={workflowTemplates.map((template) => ({ value: template.id, label: template.name }))}
                  onChange={applyTemplate}
                />
              </Form.Item>
            </Form>
            <div className="prototype-notice">
              <b>{activeTemplate.scene}</b>
              <p className="!mb-0 !mt-2 text-slate-600">{activeTemplate.description}</p>
            </div>
          </Card>

          <Card title="模板库">
            <div className="grid gap-3">
              {workflowTemplates.map((template) => (
                <button
                  className={`prototype-template-card ${template.id === selectedTemplateId ? "active" : ""}`}
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                >
                  <b>{template.name}</b>
                  <span>{template.owner}</span>
                  <small>{template.description}</small>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card
          title="步骤配置"
          extra={<Tag color="blue">保存后随智能体生效</Tag>}
        >
          {steps.length ? (
            <div className="grid gap-3">
              {steps.map((step, index) => (
                <div className={`prototype-step-editor ${step.enabled ? "active" : ""}`} key={step.id}>
                  <span className="prototype-step-num">{index + 1}</span>
                  <div className="min-w-0">
                    <Row gutter={[12, 10]}>
                      <Col xs={24} xl={8}>
                        <Typography.Text type="secondary">步骤类型</Typography.Text>
                        <Select
                          className="mt-1 w-full"
                          value={step.type}
                          options={stepTypeOptions}
                          onChange={(value) => patchStep(step.id, { type: value, title: stepTitles[value], description: stepDescriptions[value] })}
                        />
                      </Col>
                      <Col xs={24} xl={8}>
                        <Typography.Text type="secondary">显示名称</Typography.Text>
                        <Input className="mt-1" value={step.title} onChange={(event) => patchStep(step.id, { title: event.target.value })} />
                      </Col>
                      <Col xs={24} xl={8}>
                        <Typography.Text type="secondary">执行参数</Typography.Text>
                        {step.type === "retrieve_kb" ? (
                          <InputNumber className="mt-1 w-full" min={1} max={50} value={step.top_k || 10} onChange={(value) => patchStep(step.id, { top_k: Number(value || 10) })} />
                        ) : step.type === "format_output" ? (
                          <Input className="mt-1" value={step.format || ""} placeholder="markdown_report" onChange={(event) => patchStep(step.id, { format: event.target.value })} />
                        ) : step.type === "human_review" ? (
                          <Switch className="mt-2" checked={!!step.required} checkedChildren="必审" unCheckedChildren="可选" onChange={(value) => patchStep(step.id, { required: value })} />
                        ) : (
                          <Input className="mt-1" disabled value="使用默认参数" />
                        )}
                      </Col>
                      <Col span={24}>
                        <Typography.Text type="secondary">步骤说明</Typography.Text>
                        <Input.TextArea rows={2} className="mt-1" value={step.description} onChange={(event) => patchStep(step.id, { description: event.target.value })} />
                      </Col>
                    </Row>
                  </div>
                  <div className="prototype-step-actions">
                    <Switch checked={step.enabled} checkedChildren="启用" unCheckedChildren="停用" onChange={(value) => patchStep(step.id, { enabled: value })} />
                    <Space>
                      <Button size="small" icon={<UpOutlined />} disabled={index === 0} onClick={() => moveStep(index, -1)} />
                      <Button size="small" icon={<DownOutlined />} disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))} />
                    </Space>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="还没有配置步骤" />
          )}
        </Card>

        <div className="grid gap-4">
          <Card title="运行结果">
            {result ? (
              <>
                <Timeline items={traceToTimeline(result.trace)} />
                <Divider />
                <Typography.Paragraph type="secondary" className="!mb-0">
                  本次运行耗时 {result.latency_ms} ms，已写入工作流记录。
                </Typography.Paragraph>
              </>
            ) : (
              <>
                <Timeline
                  items={[
                    { icon: <CheckCircleOutlined />, color: "green", content: "选择智能体和流程模板" },
                    { icon: <ClockCircleOutlined />, color: "blue", content: "试运行后展示每一步结果" }
                  ]}
                />
                <Typography.Paragraph type="secondary" className="!mb-0">
                  试运行会使用当前页面配置，不需要先保存。
                </Typography.Paragraph>
              </>
            )}
          </Card>

          <Card title="员工如何使用">
            <div className="grid gap-3">
              <div className="prototype-run-card">
                <b>1. 管理员配置流程</b>
                <span>选择模板、调整步骤、绑定到智能体。</span>
              </div>
              <div className="prototype-run-card">
                <b>2. 员工选择智能体</b>
                <span>普通用户不需要进入工作流页面。</span>
              </div>
              <div className="prototype-run-card">
                <b>3. 系统按流程执行</b>
                <span>检索、工具、生成、引用和日志自动完成。</span>
              </div>
            </div>
            <Divider />
            <Space wrap>
              <Tag color="blue">人工审核可配置</Tag>
              <Tag color="cyan">多智能体协作预留</Tag>
              <Tag color="green">全程留痕</Tag>
            </Space>
          </Card>
        </div>
      </div>
    </>
  );
}
