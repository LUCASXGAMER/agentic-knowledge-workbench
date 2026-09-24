import { Card, Table, Tag } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { ToolLog } from "../types";

export function ToolLogsPage() {
  const { data, loading } = useApiData<ToolLog[]>(async () => (await api.get("/logs/tools")).data, []);
  return (
    <>
      <PageHeader title="工具调用日志页" description="记录工具调用的智能体、调用者、权限、状态、耗时和异常信息。" />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><span className="text-slate-500">工具调用</span><b className="mt-2 block text-[32px]">{data.length}</b><small className="font-extrabold text-[#12a89d]">今日</small></Card>
        <Card><span className="text-slate-500">成功率</span><b className="mt-2 block text-[32px]">97.7%</b><small className="font-extrabold text-[#12a89d]">运行稳定</small></Card>
        <Card><span className="text-slate-500">审批拦截</span><b className="mt-2 block text-[32px]">5</b><small className="font-extrabold text-[#c9871a]">高风险请求</small></Card>
        <Card><span className="text-slate-500">平均耗时</span><b className="mt-2 block text-[32px]">210ms</b><small className="font-extrabold text-[#12a89d]">低风险工具</small></Card>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: "用户", dataIndex: "user_name", render: (v) => v || "-" },
            { title: "智能体", dataIndex: "agent_name", render: (v) => v || "-" },
            { title: "工具", dataIndex: "tool_name" },
            { title: "状态", dataIndex: "status", render: (v) => <Tag color={v === "failed" ? "red" : "green"}>{v}</Tag> },
            { title: "耗时 ms", dataIndex: "latency_ms" },
            { title: "异常信息", dataIndex: "error_message" },
            { title: "时间", dataIndex: "created_at" }
          ]}
        />
      </Card>
    </>
  );
}
