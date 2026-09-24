export type Role = "super_admin" | "admin" | "user";
export type AnswerMode = "kb_only" | "web_only" | "hybrid";

export interface Metric {
  label: string;
  value: string;
  trend: string;
  tone: "blue" | "green" | "amber" | "red";
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  role_prompt?: string;
  system_prompt?: string;
  welcome_message?: string;
  output_format?: string;
  forbidden_rules?: string;
  answerMode?: AnswerMode;
  answer_mode?: AnswerMode;
  model_config?: Record<string, unknown>;
  kbs?: string[];
  tools?: string[];
  bound_knowledge_bases?: string[];
  bound_tools?: string[];
  workflow_config?: Record<string, unknown>;
  visibility?: string;
  enabled: boolean;
}

export interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at?: string;
}

export interface AgentAccess {
  id: string;
  agent_id: string;
  user_id: string;
  granted_by?: string;
  created_at: string;
  user?: UserAccount;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents?: number;
  chunks?: number;
  document_count?: number;
  chunk_count?: number;
  visibility: string;
  embedding?: string;
  embedding_model?: string;
  chunking_strategy?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentPayload {
  name: string;
  avatar?: string;
  description?: string;
  role_prompt?: string;
  system_prompt?: string;
  welcome_message?: string;
  output_format?: string;
  forbidden_rules?: string;
  answer_mode?: AnswerMode;
  model_config?: Record<string, unknown>;
  bound_knowledge_bases?: string[];
  bound_tools?: string[];
  workflow_config?: Record<string, unknown>;
  visibility?: string;
  enabled?: boolean;
}

export interface KnowledgeBasePayload {
  name: string;
  description?: string;
  visibility?: string;
  chunking_strategy?: string;
}

export interface Citation {
  fileName?: string;
  file_name?: string;
  page?: number;
  section?: string;
  section_title?: string;
  score: number;
  sourceType?: "knowledge_base" | "web";
  source_type?: "knowledge_base" | "web";
  text?: string;
  chunk_text?: string;
  document_id?: string;
  chunk_id?: string;
}

export interface DocumentItem {
  id: string;
  kb_id: string;
  file_name: string;
  file_type: string;
  status: string;
  parse_message: string;
  version: string;
  page_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChunkItem {
  id: string;
  document_id: string;
  kb_id: string;
  file_name: string;
  page?: number;
  section_title: string;
  text: string;
  source_type: string;
  token_count: number;
  version: string;
  embedding_model: string;
  created_at: string;
}

export interface IndexJob {
  id: string;
  kb_id: string;
  status: "queued" | "running" | "success" | "failed";
  total_documents: number;
  processed_documents: number;
  chunk_count: number;
  error_message: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  metrics: Metric[];
  trend: Array<{ day: string; qa: number; hit: number }>;
  knowledge_bases: KnowledgeBase[];
  agents: Agent[];
  recent_documents: DocumentItem[];
  recent_qa: Array<{ id: string; agent_id?: string; question: string; refused: boolean; latency_ms: number; created_at: string }>;
  system_status: Array<{ name: string; status: string; tone: "blue" | "green" | "amber" | "red" }>;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  trace: Array<Record<string, unknown>>;
  refused: boolean;
  answer_mode: AnswerMode;
  model: string;
  latency_ms: number;
  qa_log_id?: string;
}

export interface WorkflowTraceStep {
  index: number;
  type: string;
  status: "success" | "skipped" | "failed";
  message?: string;
  detail?: Record<string, unknown>;
}

export interface WorkflowRunResult {
  status: string;
  trace: WorkflowTraceStep[];
  latency_ms: number;
  agent_id: string;
  agent_name: string;
}

export interface ToolItem {
  id: string;
  name?: string;
  description: string;
  enabled: boolean;
  permission_level: Role | "super_admin" | "admin" | "user";
  require_admin_approval: boolean;
  callable_by_agents: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EvalRun {
  id: string;
  name: string;
  status: string;
  report_path: string;
  created_at: string;
  metrics: Record<string, number>;
}

export interface QaLog {
  id: string;
  user_id?: string;
  user_name?: string;
  agent_id?: string;
  agent_name?: string;
  question: string;
  answer?: string;
  answer_mode?: string;
  refused?: boolean;
  status?: string;
  citation_count?: number;
  latency?: number;
  latency_ms?: number;
  created_at?: string;
}

export interface ToolLog {
  id: string;
  user_name?: string;
  agent_name?: string;
  tool?: string;
  tool_name?: string;
  status: string;
  latency?: number;
  latency_ms?: number;
  error_message?: string;
  created_at?: string;
}

export interface WorkflowLog {
  id: string;
  user_name?: string;
  agent_id?: string;
  agent_name?: string;
  status: string;
  steps?: Array<Record<string, unknown>>;
  latency_ms?: number;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  user_name?: string;
  action: string;
  target_type: string;
  target_id?: string;
  created_at?: string;
}
