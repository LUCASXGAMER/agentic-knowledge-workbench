import { Card, Tabs, Table, Tag, Typography } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { AuditLog, QaLog, ToolLog, WorkflowLog } from "../types";

const qa: QaLog[] = [
  { id: "qa1", user_name: "admin@example.com", agent_name: "制度问答助手", question: "忘记打卡怎么办？", status: "已回答", latency: 420 },
  { id: "qa2", user_name: "user@example.com", agent_name: "合同审查助手", question: "这条违约金是否过高？", status: "已回答", latency: 730 },
  { id: "qa3", user_name: "user@example.com", agent_name: "制度问答助手", question: "公司股票怎么买？", status: "已拒答", latency: 110 }
];

const tools: ToolLog[] = [
  { id: "t1", tool: "kb_retrieval", status: "success", latency: 88 },
  { id: "t2", tool: "excel_summary", status: "success", latency: 210 },
  { id: "t3", tool: "local_python_script", status: "blocked", latency: 0 }
];

const workflows: WorkflowLog[] = [
  { id: "w1", agent_id: "制度问答助手", status: "success", steps: [{ type: "retrieve_kb" }, { type: "final_output" }], latency_ms: 320 }
];

export function LogsPage() {
  const qaData = useApiData<QaLog[]>(async () => (await api.get("/logs/qa")).data, qa);
  const toolData = useApiData<ToolLog[]>(async () => (await api.get("/logs/tools")).data, tools);
  const workflowData = useApiData<WorkflowLog[]>(async () => (await api.get("/logs/workflows")).data, workflows);
  const auditData = useApiData<AuditLog[]>(async () => (await api.get("/logs/audit")).data, [{ id: "a1", action: "login", target_type: "user", target_id: "user", created_at: "" }]);
  return (
    <>
      <PageHeader title="日志审计" description="查看问答、上传、检索、工具调用、工作流、反馈和错误日志。" />
      <Card>
        <Tabs
          items={[
            {
              key: "qa",
              label: "问答日志",
              children: (
                <Table rowKey="id" loading={qaData.loading} dataSource={qaData.data} columns={[
                  { title: "用户", dataIndex: "user_id", render: (v) => v || "当前用户" },
                  { title: "智能体", dataIndex: "agent_name", render: (v, row) => v || row.agent_id || "-" },
                  { title: "问题", dataIndex: "question" },
                  { title: "状态", render: (_, row) => <Tag color={row.refused || row.status === "已拒答" ? "orange" : "green"}>{row.refused || row.status === "已拒答" ? "已拒答" : "已回答"}</Tag> },
                  { title: "引用", dataIndex: "citation_count", render: (v) => v ?? 0 },
                  { title: "耗时 ms", dataIndex: "latency_ms", render: (v, row) => v ?? row.latency }
                ]} />
              )
            },
            {
              key: "tools",
              label: "工具调用",
              children: (
                <Table rowKey="id" loading={toolData.loading} dataSource={toolData.data} columns={[
                  { title: "智能体", dataIndex: "agent_name", render: (v) => v || "-" },
                  { title: "工具", dataIndex: "tool_name", render: (v, row) => v || row.tool },
                  { title: "状态", dataIndex: "status", render: (v) => <Tag color={v === "blocked" || v === "failed" ? "red" : "green"}>{v}</Tag> },
                  { title: "耗时 ms", dataIndex: "latency_ms", render: (v, row) => v ?? row.latency }
                ]} />
              )
            },
            {
              key: "workflows",
              label: "工作流",
              children: (
                <Table rowKey="id" loading={workflowData.loading} dataSource={workflowData.data} columns={[
                  { title: "用户", dataIndex: "user_name", render: (v) => v || "-" },
                  { title: "智能体", dataIndex: "agent_name", render: (v, row) => v || row.agent_id || "-" },
                  { title: "状态", dataIndex: "status", render: (v) => <Tag color={v === "success" ? "green" : "red"}>{v === "success" ? "成功" : v}</Tag> },
                  { title: "步骤数", dataIndex: "steps", render: (v) => Array.isArray(v) ? v.length : 0 },
                  { title: "耗时 ms", dataIndex: "latency_ms" },
                  { title: "时间", dataIndex: "created_at" }
                ]} />
              )
            },
            {
              key: "audit",
              label: "操作审计",
              children: <Table rowKey="id" loading={auditData.loading} dataSource={auditData.data} columns={[{ title: "用户", dataIndex: "user_name", render: (v) => v || "-" }, { title: "动作", dataIndex: "action" }, { title: "对象", dataIndex: "target_type" }, { title: "目标", dataIndex: "target_id", render: (v) => <Typography.Text code>{String(v || "-").slice(0, 12)}</Typography.Text> }, { title: "时间", dataIndex: "created_at" }]} />
            }
          ]}
        />
      </Card>
    </>
  );
}
