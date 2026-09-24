import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "./layouts/AppShell";
import { AgentEditorPage } from "./pages/AgentEditorPage";
import { AgentsPage } from "./pages/AgentsPage";
import { ChatPage } from "./pages/ChatPage";
import { ChunksPage } from "./pages/ChunksPage";
import { CitationPage } from "./pages/CitationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EvalPage } from "./pages/EvalPage";
import { KnowledgeBaseDetailPage } from "./pages/KnowledgeBaseDetailPage";
import { KnowledgeBasesPage } from "./pages/KnowledgeBasesPage";
import { LoginPage } from "./pages/LoginPage";
import { LogsPage } from "./pages/LogsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { QaLogsPage } from "./pages/QaLogsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ToolLogsPage } from "./pages/ToolLogsPage";
import { ToolsPage } from "./pages/ToolsPage";
import { UploadPage } from "./pages/UploadPage";
import { UsersPage } from "./pages/UsersPage";
import { WorkflowPage } from "./pages/WorkflowPage";
import { useAuthStore } from "./store/authStore";
import type { Role } from "./types";

function PrivateRoute() {
  const token = useAuthStore((state) => state.token);
  return token ? <AppShell /> : <Navigate to="/login" replace />;
}

function RoleRoute({ allowed, children }: { allowed: Role[]; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  return allowed.includes((user?.role || "user") as Role) ? children : <Navigate to="/chat" replace />;
}

const adminRoles: Role[] = ["super_admin", "admin"];
const superAdminRoles: Role[] = ["super_admin"];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agent-editor" element={<RoleRoute allowed={adminRoles}><AgentEditorPage /></RoleRoute>} />
          <Route path="/workflow" element={<RoleRoute allowed={adminRoles}><WorkflowPage /></RoleRoute>} />
          <Route path="/tools" element={<RoleRoute allowed={adminRoles}><ToolsPage /></RoleRoute>} />
          <Route path="/knowledge-bases" element={<RoleRoute allowed={adminRoles}><KnowledgeBasesPage /></RoleRoute>} />
          <Route path="/knowledge-bases/:id" element={<RoleRoute allowed={adminRoles}><KnowledgeBaseDetailPage /></RoleRoute>} />
          <Route path="/upload" element={<RoleRoute allowed={adminRoles}><UploadPage /></RoleRoute>} />
          <Route path="/documents" element={<RoleRoute allowed={adminRoles}><DocumentsPage /></RoleRoute>} />
          <Route path="/chunks" element={<RoleRoute allowed={adminRoles}><ChunksPage /></RoleRoute>} />
          <Route path="/citation" element={<CitationPage />} />
          <Route path="/eval" element={<RoleRoute allowed={adminRoles}><EvalPage /></RoleRoute>} />
          <Route path="/logs" element={<RoleRoute allowed={adminRoles}><LogsPage /></RoleRoute>} />
          <Route path="/qa-logs" element={<RoleRoute allowed={adminRoles}><QaLogsPage /></RoleRoute>} />
          <Route path="/tool-logs" element={<RoleRoute allowed={adminRoles}><ToolLogsPage /></RoleRoute>} />
          <Route path="/users" element={<RoleRoute allowed={superAdminRoles}><UsersPage /></RoleRoute>} />
          <Route path="/permissions" element={<RoleRoute allowed={superAdminRoles}><PermissionsPage /></RoleRoute>} />
          <Route path="/models" element={<RoleRoute allowed={superAdminRoles}><ModelsPage /></RoleRoute>} />
          <Route path="/settings" element={<RoleRoute allowed={superAdminRoles}><SettingsPage /></RoleRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
