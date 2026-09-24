import { Tag } from "antd";
import type { AnswerMode } from "../types";

const label: Record<AnswerMode, string> = {
  kb_only: "仅知识库",
  web_only: "联网检索",
  hybrid: "混合模式"
};

const color: Record<AnswerMode, string> = {
  kb_only: "blue",
  web_only: "gold",
  hybrid: "green"
};

export function ModeTag({ mode }: { mode: AnswerMode }) {
  return <Tag color={color[mode]}>{label[mode]}</Tag>;
}
