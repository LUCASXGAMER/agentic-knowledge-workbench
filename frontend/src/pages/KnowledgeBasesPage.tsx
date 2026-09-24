import { App, Button, Card, Col, Form, Input, Modal, Row, Select, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createKnowledgeBase, fetchKnowledgeBases, rebuildKnowledgeBase } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { knowledgeBases } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";

export function KnowledgeBasesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuildingId, setRebuildingId] = useState("");
  const { data, loading, reload } = useApiData(fetchKnowledgeBases, knowledgeBases);

  async function handleCreate() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await createKnowledgeBase(values);
      setOpen(false);
      form.resetFields();
      await reload();
    } catch {
      message.error("创建失败，请确认账号权限和后端服务状态");
    } finally {
      setSaving(false);
    }
  }

  async function handleRebuild(kbId: string) {
    setRebuildingId(kbId);
    try {
      const job = await rebuildKnowledgeBase(kbId);
      message.success(`重建任务已创建：${job.status}`);
      await reload();
    } catch {
      message.error("重建失败，请确认账号权限和后端服务状态");
    } finally {
      setRebuildingId("");
    }
  }

  return (
    <>
      <PageHeader title="知识库列表页" description="管理多个知识库，支持上传、重建索引、查看分片和绑定智能体。" />
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">知识库数量</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.length}</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">制度、合同、技术、项目</Typography.Text></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">文档数量</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.reduce((sum, row) => sum + Number(row.document_count ?? row.documents ?? 0), 0)}</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">本地解析</Typography.Text></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">分片数量</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">{data.reduce((sum, row) => sum + Number(row.chunk_count ?? row.chunks ?? 0), 0)}</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">结构化引用</Typography.Text></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card styles={{ body: { padding: 18 } }}><Typography.Text type="secondary">索引状态</Typography.Text><Typography.Title level={3} className="!mb-1 !mt-2 !text-[32px]">可检索</Typography.Title><Typography.Text className="!font-extrabold !text-[#12a89d]">按库隔离</Typography.Text></Card>
        </Col>
      </Row>
      <Card extra={<Button type="primary" onClick={() => setOpen(true)}>新建知识库</Button>}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: "名称", dataIndex: "name", render: (v, row) => <Typography.Link onClick={() => navigate(`/knowledge-bases/${row.id}`)}>{v}</Typography.Link> },
            { title: "说明", dataIndex: "description" },
            { title: "文档", render: (_, row) => row.document_count ?? row.documents ?? 0 },
            { title: "分片", render: (_, row) => row.chunk_count ?? row.chunks ?? 0 },
            { title: "Embedding", render: (_, row) => row.embedding_model || row.embedding },
            { title: "权限", dataIndex: "visibility", render: (v) => <Tag>{v}</Tag> },
            { title: "操作", render: (_, row) => <Button size="small" loading={rebuildingId === row.id} onClick={() => handleRebuild(row.id)}>重建索引</Button> }
          ]}
        />
      </Card>
      <Modal
        title="新建知识库"
        open={open}
        onOk={handleCreate}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ visibility: "team", chunking_strategy: "default_policy_clause" }}>
          <Form.Item label="知识库名称" name="name" rules={[{ required: true, message: "请输入知识库名称" }]}>
            <Input placeholder="制度库" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} placeholder="说明知识库的资料范围" />
          </Form.Item>
          <Form.Item label="可见范围" name="visibility">
            <Select options={[{ value: "private", label: "私有" }, { value: "team", label: "团队" }, { value: "public_internal", label: "内部公开" }]} />
          </Form.Item>
          <Form.Item label="切分策略" name="chunking_strategy">
            <Select options={[{ value: "default_policy_clause", label: "制度条款优先" }, { value: "meeting_minutes", label: "会议纪要" }, { value: "table_rows", label: "表格行记录" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
