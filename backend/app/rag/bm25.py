from __future__ import annotations

import math
from collections import Counter

from app.rag.embedding import tokenize


class SimpleBM25:
    def __init__(self, documents: list[str]):
        self.documents = documents
        self.tokenized = [tokenize(doc) for doc in documents]
        self.avgdl = sum(len(doc) for doc in self.tokenized) / max(len(self.tokenized), 1)
        self.df: Counter[str] = Counter()
        for doc in self.tokenized:
            self.df.update(set(doc))

    def scores(self, query: str) -> list[float]:
        query_tokens = tokenize(query)
        total_docs = max(len(self.documents), 1)
        scores: list[float] = []
        for doc in self.tokenized:
            freqs = Counter(doc)
            doc_len = len(doc) or 1
            score = 0.0
            for token in query_tokens:
                if token not in freqs:
                    continue
                idf = math.log(1 + (total_docs - self.df[token] + 0.5) / (self.df[token] + 0.5))
                tf = freqs[token]
                score += idf * (tf * 2.2) / (tf + 1.2 * (1 - 0.75 + 0.75 * doc_len / max(self.avgdl, 1)))
            scores.append(score)
        max_score = max(scores) if scores else 0.0
        if max_score <= 0:
            return scores
        return [score / max_score for score in scores]
