from __future__ import annotations

import hashlib
import math
import re


class HashEmbeddingProvider:
    """Small deterministic embedding used for local demos and tests.

    Production deployments should switch to bge-m3 or another configured embedding model.
    """

    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        for token in tokenize(text):
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9_]+", text.lower())
    return [word for word in words if word.strip()]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    length = min(len(left), len(right))
    return sum(left[i] * right[i] for i in range(length))
