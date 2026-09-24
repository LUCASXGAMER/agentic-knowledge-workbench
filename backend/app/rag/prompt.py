from __future__ import annotations

from app.rag.retriever import RetrievedChunk


KB_ONLY_RULES = """你只能根据提供的知识库片段回答。
如果片段中没有明确依据，回答“知识库中未检索到明确依据，无法确认。”
不得使用常识补充。
不得编造文件名、页码、制度条款。
每个关键结论必须对应引用来源。"""

HYBRID_RULES = """优先使用知识库来源。
如果使用互联网来源，必须明确标注“互联网来源”。
不得把互联网信息伪装成企业内部制度。
当内部知识库与互联网冲突时，内部制度优先。"""


def build_context(chunks: list[RetrievedChunk]) -> str:
    lines: list[str] = []
    for index, item in enumerate(chunks, start=1):
        chunk = item.chunk
        page = f"第 {chunk.page} 页" if chunk.page else "页码未知"
        title = f"，章节：{chunk.section_title}" if chunk.section_title else ""
        lines.append(
            f"[知识库来源 {index}] 文件：{chunk.file_name}，{page}{title}，片段ID：{chunk.id}\n{chunk.text}"
        )
    return "\n\n".join(lines)


def build_prompt(question: str, chunks: list[RetrievedChunk], mode: str, agent_rules: str = "") -> str:
    rules = KB_ONLY_RULES if mode == "kb_only" else HYBRID_RULES
    context = build_context(chunks)
    return f"""{rules}

智能体规则：
{agent_rules or "无额外规则"}

可用资料：
{context or "没有检索到可用资料。"}

用户问题：
{question}

请给出简洁、可核查的回答。"""
