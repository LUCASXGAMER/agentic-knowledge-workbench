import { Alert, Card, Col, Row, Table, Tag, Typography } from "antd";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDashboard } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { agents, knowledgeBases, metrics } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";
import type { DashboardData } from "../types";

const trendData: { day: string; qa: number; hit: number }[] = [];

export function DashboardPage() {
  const fallback: DashboardData = {
    metrics,
    trend: trendData,
    knowledge_bases: knowledgeBases,
    agents,
    recent_documents: [],
    recent_qa: [],
    system_status: [
      { name: "业务服务", status: "展示内容", tone: "amber" },
      { name: "向量检索服务", status: "待连接", tone: "blue" },
      { name: "模型网关", status: "待连接", tone: "blue" }
    ]
  };
  const { data, loading, error } = useApiData(fetchDashboard, fallback);
  return (
    <>
      <PageHeader title="首页 Dashboard" description="展示知识库、智能体、检索质量、模型服务和近期活动。" />
      {error && <Alert className="mb-4" type="warning" showIcon message="服务不可用，当前页面可能含未更新数据；请恢复连接后再评估。" />}
      <Row gutter={[16, 16]}>
        {data.metrics.map((metric) => (
          <Col xs={24} sm={12} lg={8} xl={4} key={metric.label}>
            <MetricCard metric={metric} />
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={15}>
          <Card title="问答与作答比例趋势">
            <div style={{ width: "100%", height: 288, minWidth: 0 }}>
              <ResponsiveContainer width="99%" height={288}>
                <LineChart data={data.trend}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="qa" stroke="#2563eb" strokeWidth={3} name="问答次数" />
                  <Line type="monotone" dataKey="hit" stroke="#16a34a" strokeWidth={3} name="作答比例（非准确率）" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="系统状态">
            <div className="flex w-full flex-col gap-4">
              {data.system_status.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between"><span>{item.name}</span><Tag color={item.tone === "amber" ? "gold" : item.tone}>{item.status}</Tag></div>

                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="助手列表">
            <div className="divide-y divide-slate-100">
              {data.agents.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <Typography.Title level={5} className="!mb-1">{item.name}</Typography.Title>
                    <Typography.Text type="secondary">{item.description}</Typography.Text>
                  </div>
                  <Tag color={item.enabled ? "green" : "default"}>{item.enabled ? "可用" : "待配置"}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          {data.knowledge_bases.length ? (
            <Card title="知识库概览">
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                dataSource={data.knowledge_bases}
                columns={[
                  { title: "知识库", dataIndex: "name" },
                  { title: "文档", render: (_, row) => row.document_count ?? row.documents ?? 0 },
                  { title: "分片", render: (_, row) => row.chunk_count ?? row.chunks ?? 0 },
                  { title: "权限", dataIndex: "visibility", render: (v) => <Typography.Text code>{v}</Typography.Text> }
                ]}
              />
            </Card>
          ) : (
            <Card title="使用范围">
              <Typography.Paragraph>
                当前账号可使用已授权的智能体进行问答，知识库管理、文档上传、模型配置和日志审计由管理员维护。
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                回答中的引用来源会在对话页右侧展示，普通用户不能直接进入知识库后台。
              </Typography.Text>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
