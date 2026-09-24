import { Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { fetchAgents, fetchKnowledgeBases } from "../api/client";
import { ModeTag } from "../components/ModeTag";
import { PageHeader } from "../components/PageHeader";
import { agents, knowledgeBases } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";
import type { AnswerMode } from "../types";

const toolLabels: Record<string, string> = {
  kb_retrieval: "知识库检索",
  web_search: "联网搜索",
  excel_summary: "Excel 分析",
  word_report: "Word 报告",
  ppt_generator: "PPT 生成",
  local_python_script: "本地脚本",
  database_query: "数据查询",
  internal_api: "内部接口"
};

export function AgentsPage() {
  const navigate = useNavigate();
  const { data } = useApiData(fetchAgents, agents);
  const kbData = useApiData(fetchKnowledgeBases, knowledgeBases);
  const kbNames = new Map(kbData.data.map((kb) => [kb.id, kb.name]));
  const enabledAgents = data.filter((agent) => agent.enabled !== false).length;
  const boundKbs = new Set(data.flatMap((agent) => agent.bound_knowledge_bases || agent.kbs || [])).size;
  const boundTools = new Set(data.flatMap((agent) => agent.bound_tools || agent.tools || [])).size;
  return (
    <>
      <PageHeader title="智能体广场 / 智能体列表" description="普通用户只看到授权智能体，管理员可以创建、编辑、禁用和授权。" />
      <div className="mb-4 flex justify-end gap-2">
        <Button type="primary" onClick={() => navigate("/agent-editor")}>新建智能体</Button>
        <Button onClick={() => navigate("/chat")}>进入对话</Button>
      </div>
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} md={12} xl={6}>
          <Card className="h-full" styles={{ body: { padding: 18 } }}>
            <Typography.Text type="secondary">可用智能体</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{enabledAgents}</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#12a89d]">制度、合同、报告、技术</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="h-full" styles={{ body: { padding: 18 } }}>
            <Typography.Text type="secondary">已授权用户</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">18</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#12a89d]">按角色分配</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="h-full" styles={{ body: { padding: 18 } }}>
            <Typography.Text type="secondary">绑定知识库</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{boundKbs || kbData.data.length}</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#12a89d]">严格隔离</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="h-full" styles={{ body: { padding: 18 } }}>
            <Typography.Text type="secondary">可用工具</Typography.Text>
            <Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{boundTools || 4}</Typography.Title>
            <Typography.Text className="!font-extrabold !text-[#12a89d]">低风险工具启用</Typography.Text>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        {data.map((agent, index) => {
          const mode = (agent.answer_mode || agent.answerMode || "kb_only") as AnswerMode;
          const kbs = agent.bound_knowledge_bases || agent.kbs || [];
          const tools = agent.bound_tools || agent.tools || [];
          return (
          <Col xs={24} md={12} xl={8} key={agent.id}>
            <Card
              className="h-full"
              title={
                <div className="flex items-center gap-3">
                  <span className="prototype-agent-avatar">{index + 1}</span>
                  <span>{agent.name}</span>
                </div>
              }
            >
              <Typography.Paragraph className="min-h-[48px] !text-[#6b7a8b]">{agent.description}</Typography.Paragraph>
              <Space wrap className="mb-4">
                <ModeTag mode={mode} />
                {kbs.map((kb) => <Tag key={kb}>{kbNames.get(kb) || kb}</Tag>)}
              </Space>
              <div className="grid gap-3 text-[14px]">
                <div><b>可用工具：</b>{tools.map((tool) => toolLabels[tool] || tool).join("、") || "知识库检索"}</div>
                <div><b>授权范围：</b>{agent.visibility === "team" ? "授权团队" : "全体员工"}</div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button onClick={() => navigate("/chat")}>使用</Button>
                <Button onClick={() => navigate(`/agent-editor?id=${agent.id}`)}>配置</Button>
                <Tag color={agent.enabled ? "green" : "default"} className="ml-auto self-center">{agent.enabled ? "启用" : "停用"}</Tag>
              </div>
            </Card>
          </Col>
        );})}
      </Row>
    </>
  );
}
