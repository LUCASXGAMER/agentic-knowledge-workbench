import { InboxOutlined } from "@ant-design/icons";
import { App, Card, Select, Space, Table, Tag, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchKnowledgeBases, uploadDocument } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { knowledgeBases } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";
import type { DocumentItem } from "../types";

function statusColor(status: string) {
  if (status === "parsed") return "green";
  if (status === "empty") return "gold";
  return "blue";
}

export function UploadPage() {
  const { message } = App.useApp();
  const { data: kbs } = useApiData(fetchKnowledgeBases, knowledgeBases);
  const [selectedKb, setSelectedKb] = useState("");
  const [uploaded, setUploaded] = useState<DocumentItem[]>([]);

  useEffect(() => {
    if (!selectedKb && kbs[0]?.id) {
      setSelectedKb(kbs[0].id);
    }
  }, [kbs, selectedKb]);

  const kbOptions = useMemo(() => kbs.map((kb) => ({ value: kb.id, label: kb.name })), [kbs]);

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: true,
    customRequest: async ({ file, onSuccess, onError }) => {
      if (!selectedKb) {
        message.warning("请先选择目标知识库");
        onError?.(new Error("no knowledge base"));
        return;
      }
      try {
        const result = await uploadDocument(selectedKb, file as File);
        setUploaded((items) => [result, ...items]);
        onSuccess?.(result);
      } catch (error) {
        message.error("上传失败，请确认文件类型、大小和账号权限");
        onError?.(error as Error);
      }
    }
  };

  return (
    <>
      <PageHeader title="文档上传页" description="客户资料在本机完成上传、解析、分片和入库。" />
      <div className="prototype-two-pane">
        <div>
          <Card>
            <div className="mb-4 max-w-lg">
              <Typography.Text strong>目标知识库</Typography.Text>
              <Select className="w-full mt-2" value={selectedKb} onChange={setSelectedKb} options={kbOptions} />
            </div>
            <Upload.Dragger {...uploadProps} className="!min-h-[250px]">
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">拖拽文件到此处，或点击选择文件</p>
              <p className="ant-upload-hint">支持 PDF / Word / Excel / TXT / Markdown / 图片。系统会保留页码、章节和表格信息。</p>
            </Upload.Dragger>
          </Card>
          <Card className="mt-4" title="本次上传结果">
            <Table
              rowKey="id"
              dataSource={uploaded}
              pagination={false}
              locale={{ emptyText: "上传文件后会在这里显示结果" }}
              columns={[
                { title: "文件名", dataIndex: "file_name" },
                { title: "类型", dataIndex: "file_type", render: (value) => <Tag>{value}</Tag> },
                { title: "状态", dataIndex: "status", render: (value) => <Tag color={statusColor(value)}>{value === "parsed" ? "已入库" : value}</Tag> },
                { title: "页数", dataIndex: "page_count" },
                { title: "分片", dataIndex: "chunk_count" },
                { title: "说明", dataIndex: "parse_message", render: (value) => <Space wrap>{value || "解析完成"}</Space> }
              ]}
            />
          </Card>
        </div>
        <div>
          <Card title="处理流水线">
            {["文件校验", "文档解析", "OCR 判断", "文本清洗", "智能分片", "向量化", "写入索引"].map((step, index) => (
              <div className="prototype-step mb-3" key={step}>
                <span className="prototype-step-num">{index + 1}</span>
                <b>{step}</b>
                <Tag color={uploaded.length && index < 5 ? "green" : index === 0 ? "blue" : "gold"}>{uploaded.length && index < 5 ? "完成" : index === 0 ? "待处理" : "等待"}</Tag>
              </div>
            ))}
          </Card>
          <Card className="mt-4" title="上传规则">
            <div className="grid gap-2">
              <span className="prototype-check">PDF、Word、Excel、TXT、Markdown、图片</span>
              <span className="prototype-check">PDF 先抽取文字，文字过少才触发 OCR</span>
              <span className="prototype-check">重复文件保留版本并提示覆盖风险</span>
              <span className="prototype-check">敏感文件仅在企业内网处理</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
