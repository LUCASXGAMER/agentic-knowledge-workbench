import { App, Card, Col, Row, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchAgentAccess, fetchAgents, fetchUsers, updateAgentAccess } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { agents as fallbackAgents } from "../data/mockData";
import type { Agent, AgentAccess, UserAccount } from "../types";

const fallbackUsers: UserAccount[] = [
  { id: "u1", email: "user@example.com", full_name: "普通员工", role: "user", is_active: true },
  { id: "u2", email: "research@example.com", full_name: "研究小组", role: "user", is_active: true }
];

const roleRows = [
  { role: "super_admin", agents: "全部", kb: "全部", tools: "全部", settings: "可管理" },
  { role: "admin", agents: "创建、编辑、授权", kb: "创建、上传、重建", tools: "配置授权工具", settings: "查看运行状态" },
  { role: "user", agents: "使用授权智能体", kb: "通过回答查看引用", tools: "仅可使用授权工具", settings: "无权访问" }
];

function roleLabel(role: string) {
  if (role === "super_admin") return "超级管理员";
  if (role === "admin") return "管理员";
  return "普通用户";
}

export function PermissionsPage() {
  const { message } = App.useApp();
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [users, setUsers] = useState<UserAccount[]>(fallbackUsers);
  const [selectedAgentId, setSelectedAgentId] = useState(fallbackAgents[0]?.id || "");
  const [access, setAccess] = useState<AgentAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");

  const normalUsers = useMemo(() => users.filter((item) => item.role === "user" && item.is_active), [users]);
  const selectedAgent = agents.find((item) => item.id === selectedAgentId);
  const grantedIds = useMemo(() => new Set(access.map((item) => item.user_id)), [access]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAgents(), fetchUsers()])
      .then(([agentData, userData]) => {
        setAgents(agentData);
        setUsers(userData);
        setSelectedAgentId((current) => (agentData.some((item) => item.id === current) ? current : agentData[0]?.id || ""));
      })
      .catch(() => {
        message.warning("服务连接异常，已保留当前页面内容");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAgentId || selectedAgentId.startsWith("agent-")) {
      setAccess([]);
      return;
    }
    setLoading(true);
    fetchAgentAccess(selectedAgentId)
      .then(setAccess)
      .catch(() => setAccess([]))
      .finally(() => setLoading(false));
  }, [selectedAgentId]);

  async function handleToggle(userId: string, checked: boolean) {
    if (!selectedAgentId || selectedAgentId.startsWith("agent-")) {
      message.info("当前内容尚未连接授权服务，暂不能保存");
      return;
    }
    setSavingUserId(userId);
    const nextIds = checked ? [...grantedIds, userId] : [...grantedIds].filter((id) => id !== userId);
    try {
      const updated = await updateAgentAccess(selectedAgentId, nextIds);
      setAccess(updated);
      message.success("授权已更新");
    } catch {
      message.error("授权更新失败，请确认账号权限");
    } finally {
      setSavingUserId("");
    }
  }

  return (
    <>
      <PageHeader title="权限管理页" description="管理角色边界和智能体授权，普通用户只能使用被授权的智能体。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="角色权限">
            <Table
              rowKey="role"
              size="middle"
              dataSource={roleRows}
              pagination={false}
              columns={[
                { title: "角色", dataIndex: "role", render: (v) => <Tag color={v === "user" ? "default" : "blue"}>{roleLabel(v)}</Tag> },
                { title: "智能体", dataIndex: "agents" },
                { title: "知识库", dataIndex: "kb" },
                { title: "工具", dataIndex: "tools" },
                { title: "系统", dataIndex: "settings" }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card
            title="智能体授权"
            extra={
              <Select
                style={{ minWidth: 240 }}
                value={selectedAgentId}
                onChange={setSelectedAgentId}
                options={agents.map((item) => ({ value: item.id, label: item.name }))}
              />
            }
          >
            <Space orientation="vertical" size={12} className="w-full">
              <div>
                <Typography.Text strong>{selectedAgent?.name || "未选择智能体"}</Typography.Text>
                <Typography.Paragraph type="secondary" className="mb-0">
                  {selectedAgent?.description || "选择智能体后配置普通用户授权。"}
                </Typography.Paragraph>
              </div>
              <Table
                rowKey="id"
                loading={loading}
                dataSource={normalUsers}
                pagination={false}
                columns={[
                  { title: "用户", dataIndex: "full_name" },
                  { title: "邮箱", dataIndex: "email" },
                  { title: "角色", dataIndex: "role", render: (value) => <Tag>{roleLabel(value)}</Tag> },
                  {
                    title: "授权使用",
                    render: (_, row) => (
                      <Switch
                        checked={grantedIds.has(row.id) || selectedAgent?.visibility === "public_internal"}
                        disabled={selectedAgent?.visibility === "public_internal"}
                        loading={savingUserId === row.id}
                        onChange={(checked) => handleToggle(row.id, checked)}
                      />
                    )
                  }
                ]}
              />
              {selectedAgent?.visibility === "public_internal" ? (
                <Typography.Text type="secondary">该智能体为内部公开，普通用户默认可见。</Typography.Text>
              ) : (
                <Typography.Text type="secondary">私有或团队智能体需要单独授权。</Typography.Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}
