from app.rag.chunking import split_text
from app.rag.embedding import HashEmbeddingProvider, cosine_similarity
from app.rag.prompt import build_prompt
from app.services.model_gateway import ModelGateway


def test_chunking_preserves_policy_section_title():
    text = "第一章 考勤规则\n员工迟到超过三十分钟按旷工半天处理。\n\n第二章 报销规则\n发票需要真实有效。"
    chunks = split_text(text, chunk_size=50, chunk_overlap=5)
    assert len(chunks) >= 2
    assert any("第一章" in chunk.section_title for chunk in chunks)


def test_hash_embedding_similarity_is_deterministic():
    embedder = HashEmbeddingProvider()
    a = embedder.embed("员工考勤制度")
    b = embedder.embed("员工考勤制度")
    c = embedder.embed("数据库备份")
    assert cosine_similarity(a, b) > cosine_similarity(a, c)


def test_prompt_contains_refusal_rule():
    prompt = build_prompt("没有依据的问题", [], "kb_only")
    assert "知识库中未检索到明确依据" in prompt
    assert "不得编造" in prompt


def test_model_gateway_uses_shared_concurrency_limiter():
    left = ModelGateway()
    right = ModelGateway()
    assert left._semaphore is right._semaphore
