from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

_SEMAPHORES: dict[int, asyncio.Semaphore] = {}


def get_llm_semaphore(limit: int) -> asyncio.Semaphore:
    normalized = max(limit, 1)
    semaphore = _SEMAPHORES.get(normalized)
    if semaphore is None:
        semaphore = asyncio.Semaphore(normalized)
        _SEMAPHORES[normalized] = semaphore
    return semaphore


@dataclass
class ModelResult:
    text: str
    model: str
    token_count: int = 0


class ModelGateway:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._semaphore = get_llm_semaphore(self.settings.max_concurrent_llm_requests)

    async def generate(self, prompt: str, question: str, citations: list[dict]) -> ModelResult:
        async with self._semaphore:
            if self.settings.use_mock_llm or self.settings.llm_provider == "mock":
                return self._mock_answer(question, citations)
            if self.settings.llm_provider in {"ollama", "vllm", "openai_compatible"}:
                return await self._openai_compatible(prompt)
            return self._mock_answer(question, citations)

    def _mock_answer(self, question: str, citations: list[dict]) -> ModelResult:
        if not citations:
            return ModelResult(
                text="知识库中未检索到明确依据，无法确认。",
                model="mock_llm",
                token_count=24,
            )
        source_lines = []
        for index, citation in enumerate(citations[:3], start=1):
            page = f"第 {citation.get('page')} 页" if citation.get("page") else "页码未知"
            source_lines.append(f"{index}. {citation.get('file_name')}（{page}）")
        answer = (
            f"根据已检索到的资料，问题“{question}”可以参考以下依据处理。\n\n"
            f"核心依据来自：\n" + "\n".join(source_lines) + "\n\n"
            "请以右侧引用片段为准；如果需要正式制度口径，应由管理员补充或更新知识库。"
        )
        return ModelResult(text=answer, model="mock_llm", token_count=len(answer))

    async def _openai_compatible(self, prompt: str) -> ModelResult:
        headers = {"Authorization": f"Bearer {self.settings.llm_api_key}"}
        payload = {
            "model": self.settings.llm_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.settings.llm_temperature,
            "max_tokens": self.settings.llm_max_tokens,
        }
        url = self.settings.llm_base_url.rstrip("/") + "/chat/completions"
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage") or {}
        return ModelResult(
            text=text,
            model=self.settings.llm_model,
            token_count=int(usage.get("total_tokens") or len(text)),
        )
