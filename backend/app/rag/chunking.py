from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class TextChunk:
    text: str
    page: int | None = None
    section_title: str = ""


def estimate_tokens(text: str) -> int:
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin = len(re.findall(r"[A-Za-z0-9_]+", text))
    return chinese + latin


def split_text(
    text: str,
    chunk_size: int = 700,
    chunk_overlap: int = 120,
    page: int | None = None,
    section_title: str = "",
) -> list[TextChunk]:
    cleaned = re.sub(r"\n{3,}", "\n\n", text.strip())
    if not cleaned:
        return []

    sections = _split_by_policy_sections(cleaned)
    chunks: list[TextChunk] = []
    for title, body in sections:
        active_title = title or section_title
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
        buffer = ""
        for paragraph in paragraphs:
            candidate = f"{buffer}\n\n{paragraph}".strip() if buffer else paragraph
            if estimate_tokens(candidate) <= chunk_size:
                buffer = candidate
                continue
            if buffer:
                chunks.extend(_window_chunk(buffer, chunk_size, chunk_overlap, page, active_title))
            buffer = paragraph
        if buffer:
            chunks.extend(_window_chunk(buffer, chunk_size, chunk_overlap, page, active_title))
    return chunks


def _split_by_policy_sections(text: str) -> list[tuple[str, str]]:
    pattern = re.compile(r"(?m)^(第[一二三四五六七八九十百0-9]+[章节条]|[0-9]+[.、])\s*.+$")
    matches = list(pattern.finditer(text))
    if not matches:
        return [("", text)]
    result: list[tuple[str, str]] = []
    if matches[0].start() > 0:
        result.append(("", text[: matches[0].start()].strip()))
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        title = match.group(0).strip()
        result.append((title, text[start:end].strip()))
    return [(title, body) for title, body in result if body]


def _window_chunk(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    page: int | None,
    section_title: str,
) -> list[TextChunk]:
    if estimate_tokens(text) <= chunk_size:
        return [TextChunk(text=text, page=page, section_title=section_title)]
    units = re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9_]+|[^\s]", text)
    chunks: list[TextChunk] = []
    start = 0
    step = max(chunk_size - chunk_overlap, 1)
    while start < len(units):
        part = "".join(units[start : start + chunk_size])
        chunks.append(TextChunk(text=part, page=page, section_title=section_title))
        if start + chunk_size >= len(units):
            break
        start += step
    return chunks
