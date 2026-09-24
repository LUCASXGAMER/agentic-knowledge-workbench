import { Alert, Card, Empty, Typography } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";

type Chunk = { id: string; file_name: string; text: string; section_title?: string; page_no?: number };

export function ChunksPage() {
  const { data, loading, error } = useApiData<Chunk[]>(async () => (await api.get("/documents/chunks")).data, []);
  return <>
    <PageHeader title="文档分片" description="展示当前已入库的实际片段，不生成示例引用。" />
    {error && <Alert type="error" message="无法读取片段，请检查连接或权限。" />}
    <Card loading={loading}>
      {!data.length ? <Empty description="暂无片段，请先导入文档" /> : data.map(item => <Card key={item.id} title={item.file_name} className="mb-4">
        <Typography.Text type="secondary">{item.section_title || "正文"}</Typography.Text>
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{item.text}</Typography.Paragraph>
      </Card>)}
    </Card>
  </>;
}
