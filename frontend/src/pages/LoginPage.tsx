import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  return (
    <div className="prototype-login">
      <section className="prototype-login-hero">
        <div className="relative z-[1] flex items-center gap-3">
          <div className="prototype-logo" />
          <div>
            <b className="block text-[22px]">企业知识库智能体平台</b>
            <span className="text-xs text-white/65">企业知识库智能体平台</span>
          </div>
        </div>
        <div className="prototype-login-copy">
          <small>ENTERPRISE KNOWLEDGE AGENT</small>
          <h1>企业资料统一沉淀，智能体按权限提供服务</h1>
          <p>面向企业内网使用：支持知识库问答、智能体管理、工作流编排、工具调用、引用溯源和日志审计。</p>
        </div>
        <div className="prototype-login-stats">
          <div><i>01</i><b>知识库可追溯</b><span>回答必须展示结构化引用</span></div>
          <div><i>02</i><b>智能体可配置</b><span>角色、模型、工具、知识库隔离</span></div>
          <div><i>03</i><b>内网可访问</b><span>员工通过浏览器访问</span></div>
        </div>
      </section>
      <Card className="prototype-login-card" styles={{ body: { padding: 0 } }}>
        <div className="flex items-center gap-3 text-[#152335]">
          <div className="prototype-logo" />
          <div>
            <b className="block text-[22px]">企业知识库智能体平台</b>
            <span className="text-xs text-[#71808d]">内网部署</span>
          </div>
        </div>
        <Typography.Title level={2} className="!mb-2 !mt-7 !text-[32px]">
          登录智能体平台
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!leading-7">
          企业员工通过账号登录。普通用户只能使用授权智能体，管理员可管理知识库和工具。
        </Typography.Paragraph>
        <Form
          layout="vertical"
          initialValues={{ email: "admin@example.com", password: "ChangeMe123!" }}
          onFinish={async (values) => {
            try {
              await login(values.email, values.password);
              navigate("/");
            } catch {
              message.error("登录失败，请确认后端已启动且账号密码正确。");
            }
          }}
        >
          <Form.Item name="email" label="账号">
            <Input prefix={<MailOutlined />} size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block className="!mt-1">
            进入系统
          </Button>
        </Form>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#edf4ff] px-2 py-1 text-xs font-extrabold text-[#2867e8]">企业模型服务</span>
          <span className="rounded-full bg-[#e7f8f6] px-2 py-1 text-xs font-extrabold text-[#087d76]">引用可追溯</span>
          <span className="rounded-full bg-[#fff4df] px-2 py-1 text-xs font-extrabold text-[#916114]">权限可控</span>
        </div>
        <div className="mt-4 text-xs text-slate-500 leading-5">
          默认管理员：admin@example.com / ChangeMe123!；普通用户：user@example.com / User123456!
        </div>
      </Card>
    </div>
  );
}
