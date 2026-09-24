import { App, Button, Card, Form, Input, Modal, Select, Table, Tag } from "antd";
import { useState } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { UserAccount } from "../types";

const users: UserAccount[] = [
  { id: "u1", email: "admin@example.com", full_name: "默认管理员", role: "super_admin", is_active: true },
  { id: "u2", email: "manager@example.com", full_name: "知识库管理员", role: "admin", is_active: true },
  { id: "u3", email: "user@example.com", full_name: "普通用户", role: "user", is_active: true }
];

const roleLabels: Record<string, string> = {
  super_admin: "超级管理员",
  admin: "管理员",
  user: "普通用户"
};

export function UsersPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data, loading, reload } = useApiData<UserAccount[]>(async () => (await api.get("/users")).data, users);

  async function handleCreate() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post("/users", values);
      setOpen(false);
      form.resetFields();
      await reload();
    } catch {
      message.error("创建失败，请确认邮箱未重复且账号具备权限");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="用户管理页" description="创建账号、分配角色、禁用用户，并查看登录记录。" />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><span className="text-slate-500">用户总数</span><b className="mt-2 block text-[32px]">{data.length}</b><small className="font-extrabold text-[#12a89d]">含管理员</small></Card>
        <Card><span className="text-slate-500">管理员</span><b className="mt-2 block text-[32px]">{data.filter((item) => item.role !== "user").length}</b><small className="font-extrabold text-[#12a89d]">管理知识库</small></Card>
        <Card><span className="text-slate-500">普通用户</span><b className="mt-2 block text-[32px]">{data.filter((item) => item.role === "user").length}</b><small className="font-extrabold text-[#12a89d]">授权使用智能体</small></Card>
        <Card><span className="text-slate-500">停用账号</span><b className="mt-2 block text-[32px]">{data.filter((item) => item.is_active === false).length}</b><small className="font-extrabold text-[#c9871a]">离职归档</small></Card>
      </div>
      <Card extra={<Button type="primary" onClick={() => setOpen(true)}>新建用户</Button>}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: "邮箱", dataIndex: "email" },
            { title: "姓名", dataIndex: "full_name" },
            { title: "角色", dataIndex: "role", render: (value) => <Tag color={value === "user" ? "default" : "blue"}>{roleLabels[value] || value}</Tag> },
            { title: "状态", dataIndex: "is_active", render: (value) => <Tag color={value === false ? "red" : "green"}>{value === false ? "停用" : "启用"}</Tag> }
          ]}
        />
      </Card>
      <Modal
        title="新建用户"
        open={open}
        onOk={handleCreate}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ role: "user", password: "User123456!" }}>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
            <Input placeholder="new.user@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item label="姓名" name="full_name" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input placeholder="张三" />
          </Form.Item>
          <Form.Item label="初始密码" name="password" rules={[{ required: true, min: 8, message: "至少 8 位" }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="角色" name="role">
            <Select options={[{ value: "user", label: "普通用户" }, { value: "admin", label: "管理员" }, { value: "super_admin", label: "超级管理员" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
