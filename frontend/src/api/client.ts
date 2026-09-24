import axios from "axios";
import type {
  Agent,
  AgentAccess,
  AgentPayload,
  ChatResponse,
  ChunkItem,
  DashboardData,
  DocumentItem,
  IndexJob,
  KnowledgeBase,
  KnowledgeBasePayload,
  UserAccount,
  WorkflowRunResult
} from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function fetchDashboard() {
  const response = await api.get<DashboardData>("/dashboard");
  return response.data;
}

export async function fetchAgents() {
  const response = await api.get<Agent[]>("/agents");
  return response.data;
}

export async function fetchAgent(id: string) {
  const response = await api.get<Agent>(`/agents/${id}`);
  return response.data;
}

export async function fetchUsers() {
  const response = await api.get<UserAccount[]>("/users");
  return response.data;
}

export async function fetchAgentAccess(agentId: string) {
  const response = await api.get<AgentAccess[]>(`/agents/${agentId}/access`);
  return response.data;
}

export async function updateAgentAccess(agentId: string, userIds: string[]) {
  const response = await api.put<AgentAccess[]>(`/agents/${agentId}/access`, { user_ids: userIds });
  return response.data;
}

export async function fetchKnowledgeBases() {
  const response = await api.get<KnowledgeBase[]>("/knowledge-bases");
  return response.data;
}

export async function createKnowledgeBase(payload: KnowledgeBasePayload) {
  const response = await api.post<KnowledgeBase>("/knowledge-bases", payload);
  return response.data;
}

export async function fetchKnowledgeBase(id: string) {
  const response = await api.get<KnowledgeBase>(`/knowledge-bases/${id}`);
  return response.data;
}

export async function fetchDocuments() {
  const response = await api.get<DocumentItem[]>("/documents");
  return response.data;
}

export async function fetchKnowledgeBaseDocuments(kbId: string) {
  const response = await api.get<DocumentItem[]>(`/knowledge-bases/${kbId}/documents`);
  return response.data;
}

export async function fetchKnowledgeBaseChunks(kbId: string) {
  const response = await api.get<ChunkItem[]>(`/knowledge-bases/${kbId}/chunks`);
  return response.data;
}

export async function rebuildKnowledgeBase(kbId: string) {
  const response = await api.post<IndexJob>(`/knowledge-bases/${kbId}/rebuild`);
  return response.data;
}

export async function fetchKnowledgeBaseRebuildJobs(kbId: string) {
  const response = await api.get<IndexJob[]>(`/knowledge-bases/${kbId}/rebuild-jobs`);
  return response.data;
}

export async function createAgent(payload: AgentPayload) {
  const response = await api.post<Agent>("/agents", payload);
  return response.data;
}

export async function updateAgent(id: string, payload: AgentPayload) {
  const response = await api.put<Agent>(`/agents/${id}`, payload);
  return response.data;
}

export async function uploadDocument(kbId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<DocumentItem>(`/documents/upload/${kbId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000
  });
  return response.data;
}

export async function reparseDocument(documentId: string) {
  const response = await api.post<DocumentItem>(`/documents/${documentId}/reparse`);
  return response.data;
}

export async function sendChat(agentId: string, question: string, answerMode?: string) {
  const response = await api.post<ChatResponse>("/chat", {
    agent_id: agentId,
    question,
    answer_mode: answerMode
  });
  return response.data;
}

export async function submitFeedback(qaLogId: string, rating: string, comment = "") {
  const response = await api.post(`/chat/${qaLogId}/feedback`, { rating, comment });
  return response.data;
}

export async function runWorkflow(agentId: string, workflowConfig?: Record<string, unknown>) {
  const response = await api.post<WorkflowRunResult>("/workflows/run", {
    agent_id: agentId,
    workflow_config: workflowConfig
  });
  return response.data;
}
