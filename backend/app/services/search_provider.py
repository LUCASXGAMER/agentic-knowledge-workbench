from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    source_type: str = "web"


class SearchProvider:
    async def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        settings = get_settings()
        if not settings.enable_web_search or settings.search_provider == "disabled":
            return []
        if settings.search_provider == "searxng" and settings.search_base_url:
            return await self._searxng(query, top_k)
        return []

    async def _searxng(self, query: str, top_k: int) -> list[SearchResult]:
        settings = get_settings()
        url = settings.search_base_url.rstrip("/") + "/search"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, params={"q": query, "format": "json"})
            response.raise_for_status()
            data = response.json()
        results = []
        for item in data.get("results", [])[:top_k]:
            results.append(
                SearchResult(
                    title=item.get("title", "互联网来源"),
                    url=item.get("url", ""),
                    snippet=item.get("content", ""),
                )
            )
        return results
