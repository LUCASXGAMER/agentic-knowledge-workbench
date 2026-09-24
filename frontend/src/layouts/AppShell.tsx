import {
  ApiOutlined,
  AuditOutlined,
  BarChartOutlined,
  BookOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  LockOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { Layout } from "antd";
import type { ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../types";

const { Header, Sider, Content } = Layout;

type AppMenuItem = {
  key: string;
  icon: ReactNode;
  label: string;
  roles?: Role[];
};

const allMenuItems: AppMenuItem[] = [
  { key: "/", icon: <DashboardOutlined />, label: "首页 Dashboard" },
  { key: "/agents", icon: <RobotOutlined />, label: "智能体广场" },
  { key: "/chat", icon: <MessageOutlined />, label: "智能体对话" },
  { key: "/agent-editor", icon: <SettingOutlined />, label: "智能体配置", roles: ["super_admin", "admin"] },
  { key: "/workflow", icon: <ApiOutlined />, label: "工作流配置", roles: ["super_admin", "admin"] },
  { key: "/tools", icon: <ToolOutlined />, label: "工具管理", roles: ["super_admin", "admin"] },
  { key: "/knowledge-bases", icon: <DatabaseOutlined />, label: "知识库管理", roles: ["super_admin", "admin"] },
  { key: "/upload", icon: <UploadOutlined />, label: "文档上传", roles: ["super_admin", "admin"] },
  { key: "/documents", icon: <BookOutlined />, label: "文档管理", roles: ["super_admin", "admin"] },
  { key: "/chunks", icon: <FileSearchOutlined />, label: "分片查看", roles: ["super_admin", "admin"] },
  { key: "/eval", icon: <BarChartOutlined />, label: "测试评估", roles: ["super_admin", "admin"] },
  { key: "/qa-logs", icon: <AuditOutlined />, label: "问答日志", roles: ["super_admin", "admin"] },
  { key: "/tool-logs", icon: <ToolOutlined />, label: "工具日志", roles: ["super_admin", "admin"] },
  { key: "/users", icon: <TeamOutlined />, label: "用户管理", roles: ["super_admin"] },
  { key: "/permissions", icon: <LockOutlined />, label: "权限管理", roles: ["super_admin"] },
  { key: "/models", icon: <CloudServerOutlined />, label: "模型配置", roles: ["super_admin"] },
  { key: "/settings", icon: <SettingOutlined />, label: "系统设置", roles: ["super_admin"] }
];

const menuGroups = [
  { label: "核心", keys: ["/", "/agents", "/chat", "/agent-editor", "/workflow", "/tools"] },
  { label: "知识库", keys: ["/knowledge-bases", "/upload", "/documents", "/chunks"] },
  { label: "治理", keys: ["/eval", "/qa-logs", "/tool-logs", "/users", "/permissions", "/models", "/settings"] }
];

function canSee(item: AppMenuItem, role: string | undefined) {
  if (!item.roles) return true;
  return item.roles.includes((role || "user") as Role);
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const visibleMenuItems = allMenuItems.filter((item) => canSee(item, user?.role));
  const selected = visibleMenuItems.find((item) => item.key === "/" ? location.pathname === "/" : location.pathname === item.key || location.pathname.startsWith(`${item.key}/`));

  return (
    <Layout className="prototype-shell">
      <Sider width={236} className="prototype-sidebar" breakpoint="lg" collapsedWidth={0}>
        <div className="px-[18px] py-[18px] text-white">
          <div className="flex items-center gap-[11px] pb-[18px]">
            <div className="prototype-logo" />
            <div>
              <div className="text-xl font-bold leading-6">企业知识库智能体平台</div>
              <div className="text-[11px] text-white/60">企业知识库智能体平台</div>
            </div>
          </div>
        </div>
        <nav className="prototype-nav">
          {menuGroups.map((group) => {
            const items = group.keys
              .map((key) => visibleMenuItems.find((item) => item.key === key))
              .filter(Boolean) as AppMenuItem[];
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div className="prototype-nav-group">{group.label}</div>
                <div className="grid gap-[6px]">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className={`prototype-nav-button ${selected?.key === item.key ? "active" : ""}`}
                      onClick={() => navigate(item.key)}
                    >
                      <span className="prototype-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="mx-4 mt-auto mb-5 rounded-[10px] border border-white/10 p-3 text-xs text-white/65">
          <div className="my-2 flex justify-between"><span>运行范围</span><b>本机演示</b></div>
          <div className="my-2 flex justify-between"><span>入口</span><b>8080</b></div>
          <div className="my-2 flex justify-between"><span>默认问答</span><b>Mock 演示</b></div>
        </div>
      </Sider>
      <Layout>
        <Header className="prototype-topbar flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <span className="prototype-pill"><i className="prototype-dot" />本机演示</span>
            <span className="prototype-pill">统一入口 8080</span>
            <span className="prototype-pill">引用可追溯</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="prototype-pill">{user?.email || "未登录"}</span>
            <button className="prototype-pill cursor-pointer" onClick={() => { logout(); navigate("/login"); }}>退出</button>
            <span className="h-[34px] w-[34px] rounded-full bg-gradient-to-br from-[#d9e2eb] to-[#aebdcb]" />
          </div>
        </Header>
        <Content className="prototype-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
