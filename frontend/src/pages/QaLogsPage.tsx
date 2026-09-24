import { Card, Table, Tag } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { QaLog } from "../types";

export function QaLogsPage() {
  const { data, loading } = useApiData<QaLog[]>(async () => (await api.get("/logs/qa")).data, []);
  return (
    <>
      <PageHeader title="问答日志页" description="记录每次问答的用户、智能体、问题、引用、状态、耗时和反馈。" />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="prototype-check">全部</span>
          <span className="prototype-check">已回答</span>
          <span className="prototype-check">已拒答</span>
          <span className="prototype-check">有纠错</span>
          <span className="prototype-check">含互联网来源</span>
        </div>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: "智能体", dataIndex: "agent_name", render: (v, row) => v || row.agent_id || "-" },
            { title: "问题", dataIndex: "question" },
            { title: "模式", dataIndex: "answer_mode" },
            { title: "状态", render: (_, row) => <Tag color={row.refused ? "orange" : "green"}>{row.refused ? "已拒答" : "已回答"}</Tag> },
            { title: "引用", dataIndex: "citation_count", render: (v) => v ?? 0 },
            { title: "耗时 ms", dataIndex: "latency_ms" },
            { title: "时间", dataIndex: "created_at" }
          ]}
        />
      </Card>
    </>
  );
}
