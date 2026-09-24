import { App, Button, Card, Descriptions, Progress, Space, Table, Tabs, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchKnowledgeBase,
  fetchKnowledgeBaseChunks,
  fetchKnowledgeBaseDocuments,
  fetchKnowledgeBaseRebuildJobs,
  rebuildKnowledgeBase,
  reparseDocument
} from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { knowledgeBases } from "../data/mockData";
import type { ChunkItem, DocumentItem, IndexJob, KnowledgeBase } from "../types";

function statusLabel(status: string) {
  if (status === "parsed") return "已入库";
  if (status === "empty") return "内容为空";
  return "处理中";
}

function jobStatusLabel(status: string) {
  if (status === "queued") return "等待中";
  if (status === "running") return "执行中";
  if (status === "success") return "已完成";
  if (status === "failed") return "失败";
  return status;
}

function jobColor(status: string) {
  if (status === "success") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "blue";
  return "gold";
}

export function KnowledgeBaseDetailPage() {
  const { message } = App.useApp();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const fallbackKb = knowledgeBases.find((item) => item.id === id) || { id: id || "", name: "加载中", description: "", documents: 0, chunks: 0, visibility: "team", embedding: "" };
  const [kb, setKb] = useState<KnowledgeBase>(fallbackKb);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [jobs, setJobs] = useState<IndexJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const progress = useMemo(() => {
    if (!documents.length) return 0;
    const ready = documents.filter((item) => item.status === "parsed").length;
    return Math.round((ready / documents.length) * 100);
  }, [documents]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchKnowledgeBase(id), fetchKnowledgeBaseDocuments(id), fetchKnowledgeBaseChunks(id), fetchKnowledgeBaseRebuildJobs(id)])
      .then(([kbData, docData, chunkData, jobData]) => {
        setKb(kbData);
        setDocuments(docData);
        setChunks(chunkData);
        setJobs(jobData);
      })
      .catch(() => {
        setDocuments([]);
        setChunks([]);
        setJobs([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function refreshDetail() {
    if (!id) return;
    const [kbData, docData, chunkData, jobData] = await Promise.all([
      fetchKnowledgeBase(id),
      fetchKnowledgeBaseDocuments(id),
      fetchKnowledgeBaseChunks(id),
      fetchKnowledgeBaseRebuildJobs(id)
    ]);
    setKb(kbData);
    setDocuments(docData);
    setChunks(chunkData);
    setJobs(jobData);
  }

  async function waitForJob(jobId: string) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (!id) return;
      const jobData = await fetchKnowledgeBaseRebuildJobs(id);
      setJobs(jobData);
      const current = jobData.find((item) => item.id === jobId);
      if (current && ["success", "failed"].includes(current.status)) {
        return;
      }
    }
  }

  async function handleReparse(documentId: string) {
    try {
      const result = await reparseDocument(documentId);
      setDocuments((items) => items.map((item) => (item.id === documentId ? result : item)));
    } catch {
      message.error("操作失败，请确认账号权限和后端服务状态");
    }
  }

  async function handleRebuild() {
    if (!id) return;
    setRebuilding(true);
    try {
      const job = await rebuildKnowledgeBase(id);
      message.success(`重建任务已创建：${jobStatusLabel(job.status)}`);
      await refreshDetail();
      await waitForJob(job.id);
      await refreshDetail();
    } catch {
      message.error("重建失败，请确认账号权限和后端服务状态");
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <>
      <PageHeader title="知识库详情页" description="查看文档、分片、引用字段和入库状态。" />
      <Card className="mb-4">
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }}>
          <Descriptions.Item label="知识库">{kb.name}</Descriptions.Item>
          <Descriptions.Item label="文档数">{kb.document_count ?? kb.documents ?? documents.length}</Descriptions.Item>
          <Descriptions.Item label="分片数">{kb.chunk_count ?? kb.chunks ?? chunks.length}</Descriptions.Item>
          <Descriptions.Item label="Embedding">{kb.embedding_model || kb.embedding}</Descriptions.Item>
          <Descriptions.Item label="可见范围">{kb.visibility}</Descriptions.Item>
          <Descriptions.Item label="索引状态"><Tag color={progress === 100 || !documents.length ? "green" : "blue"}>{progress === 100 || !documents.length ? "可检索" : "更新中"}</Tag></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card
        title="入库状态"
        extra={<Space><Button onClick={() => navigate("/upload")}>上传文档</Button><Button loading={rebuilding} onClick={handleRebuild}>重建索引</Button></Space>}
        loading={loading}
      >
        <Progress percent={progress} strokeColor="#16a34a" />
        <Tabs
          className="mt-4"
          items={[
            {
              key: "documents",
              label: "文档",
              children: (
                <Table
                  rowKey="id"
                  dataSource={documents}
                  locale={{ emptyText: "暂无文档，可先上传资料" }}
                  columns={[
                    { title: "文件", dataIndex: "file_name" },
                    { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "parsed" ? "green" : "gold"}>{statusLabel(value)}</Tag> },
                    { title: "页数", dataIndex: "page_count" },
                    { title: "分片", dataIndex: "chunk_count" },
                    { title: "版本", dataIndex: "version" },
                    { title: "说明", dataIndex: "parse_message" },
                    { title: "操作", render: (_, row) => <Button size="small" onClick={() => handleReparse(row.id)}>重新入库</Button> }
                  ]}
                />
              )
            },
            {
              key: "chunks",
              label: "分片",
              children: (
                <Table
                  rowKey="id"
                  dataSource={chunks}
                  locale={{ emptyText: "暂无分片" }}
                  columns={[
                    { title: "文件", dataIndex: "file_name" },
                    { title: "页码", dataIndex: "page" },
                    { title: "章节", dataIndex: "section_title" },
                    { title: "字数", dataIndex: "token_count" },
                    {
                      title: "内容",
                      dataIndex: "text",
                      render: (value) => <Typography.Paragraph ellipsis={{ rows: 2 }}>{value}</Typography.Paragraph>
                    }
                  ]}
                />
              )
            },
            {
              key: "jobs",
              label: "重建任务",
              children: (
                <Table
                  rowKey="id"
                  dataSource={jobs}
                  locale={{ emptyText: "暂无重建任务" }}
                  columns={[
                    { title: "任务", dataIndex: "id", render: (value) => <Typography.Text code>{String(value).slice(0, 8)}</Typography.Text> },
                    { title: "状态", dataIndex: "status", render: (value) => <Tag color={jobColor(value)}>{jobStatusLabel(value)}</Tag> },
                    {
                      title: "进度",
                      render: (_, row) => (
                        <Progress
                          percent={row.total_documents ? Math.round((row.processed_documents / row.total_documents) * 100) : 100}
                          size="small"
                          status={row.status === "failed" ? "exception" : row.status === "success" ? "success" : "active"}
                        />
                      )
                    },
                    { title: "文档", render: (_, row) => `${row.processed_documents}/${row.total_documents}` },
                    { title: "分片", dataIndex: "chunk_count" },
                    { title: "错误", dataIndex: "error_message", render: (value) => value || "-" },
                    { title: "创建时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" }
                  ]}
                />
              )
            }
          ]}
        />
      </Card>
    </>
  );
}
