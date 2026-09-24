import type { Agent, Citation, KnowledgeBase, Metric } from "../types";

// Empty states must not be mistaken for measured results.
export const metrics: Metric[] = [];
export const knowledgeBases: KnowledgeBase[] = [];
export const agents: Agent[] = [];
export const citations: Citation[] = [];
export const evalRows: { metric: string; baseline: string; current: string; target: string }[] = [];
