import { Button, Card, Empty, Typography } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import type { Citation } from "../types";

export function CitationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const citations: Citation[] = location.state?.citations || [];
  return <>
    <PageHeader title="回答来源" description="以下片段随当前回答从后端返回；没有来源时保持空状态。" />
    {!citations.length && <Empty description="请先在对话中打开一条实际引用" />}
    {citations.map((item, index) => <Card key={item.chunk_id || index} title={item.file_name || item.fileName || "来源"} className="mb-4">
      <Typography.Text type="secondary">{item.section_title || item.section || "正文"}</Typography.Text>
      <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{item.chunk_text || item.text}</Typography.Paragraph>
    </Card>)}
    <Button onClick={() => navigate("/chat")}>返回对话</Button>
  </>;
}
