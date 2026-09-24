import { App, Button, Card, Space, Table, Tag } from "antd";
import { fetchDocuments, fetchKnowledgeBases, reparseDocument } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { knowledgeBases } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";

const docs = [
  { id: "1", name: "员工考勤管理制度.md", kb: "制度库", type: "Markdown", status: "已解析", chunks: 38, version: "v1" },
  { id: "2", name: "合同审查示例.md", kb: "合同库", type: "Markdown", status: "已解析", chunks: 24, version: "v1" },
  { id: "3", name: "Excel费用统计表.csv", kb: "项目库", type: "CSV", status: "已解析", chunks: 12, version: "v1" }
];

export function DocumentsPage() {
  const { message } = App.useApp();
  const { data, loading, setData } = useApiData(fetchDocuments, docs.map((item) => ({
    id: item.id,
    kb_id: "",
    file_name: item.name,
    file_type: item.type,
    status: item.status,
    parse_message: "",
    version: item.version,
    page_count: 0,
    chunk_count: item.chunks,
    created_at: "",
    updated_at: ""
  })));
  const kbData = useApiData(fetchKnowledgeBases, knowledgeBases);
  const kbNames = new Map(kbData.data.map((kb) => [kb.id, kb.name]));

  async function handleReparse(id: string) {
    try {
      const result = await reparseDocument(id);
      setData(data.map((item) => (item.id === id ? result : item)));
    } catch {
      message.error("操作失败，请确认账号权限和后端服务状态");
    }
  }

  return (
    <>
      <PageHeader title="文档管理页" description="查看上传记录、解析状态、版本、删除文档和重新解析。" />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space wrap>
            <span className="prototype-check">全部文档</span>
            <span className="prototype-check">已解析</span>
            <span className="prototype-check">处理中</span>
            <span className="prototype-check">OCR 待复核</span>
            <span className="prototype-check">需要重建</span>
          </Space>
          <Button>批量重新解析</Button>
        </div>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: "文件名", dataIndex: "file_name" },
            { title: "知识库", dataIndex: "kb_id", render: (value) => kbNames.get(value) || value || "-" },
            { title: "类型", dataIndex: "file_type" },
            { title: "状态", dataIndex: "status", render: (v) => <Tag color={v === "parsed" || v === "已解析" ? "green" : "gold"}>{v === "parsed" ? "已解析" : v}</Tag> },
            { title: "版本", dataIndex: "version" },
            { title: "页数", dataIndex: "page_count" },
            { title: "分片", dataIndex: "chunk_count" },
            { title: "操作", render: (_, row) => <Button size="small" onClick={() => handleReparse(row.id)}>重新入库</Button> }
          ]}
        />
      </Card>
    </>
  );
}
