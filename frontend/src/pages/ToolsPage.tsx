import { App, Card, Col, Row, Switch, Table, Tag, Typography } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { ToolItem } from "../types";

const toolSeeds: Array<[string, string, ToolItem["permission_level"], boolean, boolean, boolean]> = [
  ["kb_retrieval", "知识库检索工具", "user", true, false, true],
  ["web_search", "联网搜索工具", "user", true, false, true],
  ["excel_summary", "Excel 摘要分析工具", "admin", true, false, true],
  ["word_report", "Word 报告导出工具", "admin", true, false, true],
  ["ppt_generator", "PPT 生成工具", "admin", false, true, false],
  ["local_python_script", "本地脚本执行", "super_admin", false, true, false],
  ["database_query", "数据库查询", "super_admin", false, true, false],
  ["internal_api", "内部系统接口", "admin", false, true, false]
];

const rows: ToolItem[] = toolSeeds.map(([id, description, permission_level, enabled, require_admin_approval, callable_by_agents]) => ({
  id,
  description,
  permission_level,
  enabled,
  require_admin_approval,
  callable_by_agents
}));

const roleLabels: Record<string, string> = {
  user: "普通用户",
  admin: "管理员",
  super_admin: "超级管理员"
};

export function ToolsPage() {
  const { message } = App.useApp();
  const { data, loading, setData } = useApiData<ToolItem[]>(async () => (await api.get("/tools")).data, rows);

  async function updateTool(id: string, patch: Record<string, boolean>) {
    try {
      const response = await api.put<ToolItem>(`/tools/${id}`, patch);
      setData(data.map((item) => (item.id === id ? response.data : item)));
    } catch {
      message.error("保存失败，请确认账号权限和工具风险级别");
    }
  }

  return (
    <>
      <PageHeader title="工具管理页" description="所有工具统一注册、授权、执行和记录日志；高风险工具默认关闭。" />
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">已注册工具</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.length}</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">统一注册</Typography.Text></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">可直接调用</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.filter((item) => item.enabled && item.callable_by_agents && !item.require_admin_approval).length}</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">低风险工具</Typography.Text></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">需审批工具</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.filter((item) => item.require_admin_approval).length}</Typography.Title><Typography.Text className="!font-extrabold !text-[#c9871a]">高风险受控</Typography.Text></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">默认关闭</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.filter((item) => !item.enabled).length}</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">脚本与接口</Typography.Text></Card>
        </Col>
      </Row>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: "工具", render: (_, row) => row.description || row.name || row.id },
            { title: "调用权限", dataIndex: "permission_level", render: (value) => <Tag>{roleLabels[value] || value}</Tag> },
            {
              title: "启用",
              dataIndex: "enabled",
              render: (value, row) => <Switch checked={Boolean(value)} onChange={(checked) => updateTool(row.id, { enabled: checked })} />
            },
            {
              title: "允许智能体调用",
              dataIndex: "callable_by_agents",
              render: (value, row) => <Switch checked={Boolean(value)} onChange={(checked) => updateTool(row.id, { callable_by_agents: checked })} />
            },
            {
              title: "管理员审批",
              dataIndex: "require_admin_approval",
              render: (value, row) => <Switch checked={Boolean(value)} onChange={(checked) => updateTool(row.id, { require_admin_approval: checked })} />
            },
            {
              title: "状态",
              render: (_, row) => (
                <Tag color={row.enabled && row.callable_by_agents && !row.require_admin_approval ? "green" : "gold"}>
                  {row.enabled && row.callable_by_agents && !row.require_admin_approval ? "可直接调用" : "受控"}
                </Tag>
              )
            }
          ]}
        />
      </Card>
    </>
  );
}
