import { SendOutlined } from "@ant-design/icons";
import { App, Button, Card, Empty, Input, Space, Tabs, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAgents, sendChat, submitFeedback } from "../api/client";
import { ModeTag } from "../components/ModeTag";
import { PageHeader } from "../components/PageHeader";
import { agents as fallbackAgents } from "../data/mockData";
import { useApiData } from "../hooks/useApiData";
import type { Agent, AnswerMode, ChatResponse, Citation } from "../types";

type Message = { role: "assistant" | "user"; content: string; qaLogId?: string };

const stepLabels: Record<string, string> = {
  input: "收到问题",
  retrieve_kb: "查找内部资料",
  web_search: "联网资料",
  final_output: "完成回答"
};

function modeOf(agent: Agent | undefined): AnswerMode {
  return (agent?.answer_mode || agent?.answerMode || "kb_only") as AnswerMode;
}

function citationTitle(item: Citation) {
  return item.file_name || item.fileName || "未知来源";
}

function citationSection(item: Citation) {
  return item.section_title || item.section || "未标注章节";
}

function citationText(item: Citation) {
  return item.chunk_text || item.text || "";
}

export function ChatPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { data: agentList, loading } = useApiData(fetchAgents, fallbackAgents);
  const [activeAgentId, setActiveAgentId] = useState("");
  const activeAgent = useMemo(() => agentList.find((item) => item.id === activeAgentId) || agentList[0], [agentList, activeAgentId]);
  const [question, setQuestion] = useState("员工请假需要提前多久申请？");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "你好，我是制度问答助手。请提出需要核查的问题。" }
  ]);
  const [lastResult, setLastResult] = useState<ChatResponse | null>(null);

  async function handleSend() {
    if (!question.trim() || !activeAgent) return;
    const asked = question.trim();
    setSending(true);
    setMessages((items) => [...items, { role: "user", content: asked }]);
    try {
      const result = await sendChat(activeAgent.id, asked, modeOf(activeAgent));
      setLastResult(result);
      setMessages((items) => [...items, { role: "assistant", content: result.answer, qaLogId: result.qa_log_id }]);
    } catch {
      message.error("问答服务暂不可用，请确认后端已启动并已登录。");
      setMessages((items) => [
        ...items,
        { role: "assistant", content: "当前问答服务暂不可用。请稍后重试，或联系管理员检查服务状态。" }
      ]);
    } finally {
      setSending(false);
    }
  }

  async function feedback(rating: string) {
    const qaLogId = lastResult?.qa_log_id;
    if (!qaLogId) {
      message.info("当前回答还没有可记录的问答日志。");
      return;
    }
    await submitFeedback(qaLogId, rating);
    message.success("反馈已记录");
  }

  return (
    <>
      <PageHeader title="智能体对话页" description="左侧选择智能体，中间对话，右侧展示引用来源、检索记录、工具记录和用户反馈。" />
      <div className="prototype-chat-grid">
        <Card title="授权智能体" loading={loading}>
          <div className="space-y-2">
            {agentList.map((agent, index) => (
              <button
                key={agent.id}
                className={`prototype-list-item flex w-full items-center gap-3 text-left transition ${agent.id === activeAgent?.id ? "active" : ""}`}
                onClick={() => setActiveAgentId(agent.id)}
                type="button"
              >
                <span className="prototype-agent-avatar">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{agent.name}</span>
                  <ModeTag mode={modeOf(agent)} />
                </span>
              </button>
            ))}
          </div>
          <div className="prototype-notice mt-4">
            <b>权限说明</b><br />
            普通用户只能看到授权智能体，不能创建智能体或跨库检索。
          </div>
          <Card className="mt-4" size="small" title="模式由助手配置决定">
            <Space wrap>
              <ModeTag mode={modeOf(activeAgent)} />
            </Space>
          </Card>
        </Card>
        <Card className="prototype-chat-card" title={activeAgent?.name || "智能体"} extra={<ModeTag mode={activeAgent ? modeOf(activeAgent) : "kb_only"} />}>
          <div className="flex min-h-[620px] flex-1 flex-col">
            <div className="flex-1 overflow-auto scroll-thin space-y-4 pr-2">
              {messages.map((msg, index) => (
                <div key={`${msg.role}-${index}`} className={`prototype-message ${msg.role === "user" ? "user" : ""}`}>
                  <span className="prototype-agent-avatar">{msg.role === "user" ? "人" : "智"}</span>
                  <div className="prototype-message-bubble">
                    {msg.content}
                    {msg.qaLogId && lastResult?.citations?.length ? (
                      <div className="mt-3">
                        <Tag color="blue" className="cursor-pointer" onClick={() => navigate("/citation", { state: { citations: lastResult.citations } })}>已返回 {lastResult.citations.length} 条引用</Tag>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="prototype-chat-input mt-4">
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 5 }}
                variant="borderless"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="请输入问题，支持知识库 / 联网 / 混合模式"
              />
              <div className="mt-2 flex items-center justify-between">
                <Space wrap>
                  <Tag color="blue">精准模式</Tag>
                  <Tag color="gold">联网未启用</Tag>
                </Space>
                <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={handleSend}>发送</Button>
              </div>
            </div>
          </div>
        </Card>
        <Card title="引用与记录">
          <Tabs
            items={[
              {
                key: "citations",
                label: "引用",
                children: (
                  <div className="space-y-3">
                    {(lastResult?.citations || []).map((item, index) => (
                      <div key={item.chunk_id || `${citationTitle(item)}-${index}`} className={`prototype-list-item ${item.source_type === "web" ? "prototype-source-web" : "prototype-source-local"}`}>
                        <span className="mr-2 inline-grid h-[25px] w-[25px] place-items-center rounded-md bg-[#2867e8] font-black text-white">{index + 1}</span>
                        <div className="font-medium">{citationTitle(item)}</div>
                        <Typography.Text type="secondary">
                          {citationSection(item)} {item.page ? `· 第 ${item.page} 页` : ""} · 相关度 {item.score}
                        </Typography.Text>
                        <Typography.Paragraph className="!mt-2 !mb-0 text-sm">{citationText(item)}</Typography.Paragraph>
                      </div>
                    ))}
                    {!lastResult?.citations?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="提问后展示引用来源" />}
                  </div>
                )
              },
              {
                key: "records",
                label: "检索记录",
                children: (
                  <Space orientation="vertical" className="w-full">
                    {(lastResult?.trace || []).map((item, index) => {
                      const step = String(item.step || item.type || `step-${index + 1}`);
                      return <Tag key={`${step}-${index}`} color="green">{stepLabels[step] || step}：{String(item.status || "完成")}</Tag>;
                    })}
                    {!lastResult && <Typography.Text type="secondary">提问后展示本次检索范围、来源数量和拒答状态。</Typography.Text>}
                  </Space>
                )
              },
              {
                key: "tools",
                label: "工具记录",
                children: (
                  <Space orientation="vertical" className="w-full">
                    <Tag color="blue">知识库检索：按智能体授权启用</Tag>
                    <Tag color={modeOf(activeAgent || fallbackAgents[0]) === "kb_only" ? "gold" : "green"}>联网搜索：按回答模式启用</Tag>
                    <Tag color="default">高风险工具：默认关闭</Tag>
                  </Space>
                )
              },
              {
                key: "feedback",
                label: "反馈",
                children: (
                  <Space wrap>
                    <Button onClick={() => feedback("useful")}>有用</Button>
                    <Button onClick={() => feedback("not_useful")}>无用</Button>
                    <Button onClick={() => feedback("correction")}>纠错</Button>
                  </Space>
                )
              }
            ]}
          />
        </Card>
      </div>
    </>
  );
}
