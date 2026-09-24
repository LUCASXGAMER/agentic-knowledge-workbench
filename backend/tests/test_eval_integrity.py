import pytest
from app.api.evals import metrics_from_ranks


def test_missing_measurements_are_not_presented_as_zero_or_demo_scores():
    metrics = metrics_from_ranks([])
    assert metrics["evaluated_cases"] == 0
    assert metrics["top1_hit_rate"] is None
    assert metrics["mrr"] is None


def test_misses_remain_in_the_denominator_and_ranking_changes_results():
    metrics = metrics_from_ranks([1, None, 3])
    assert metrics["top1_hit_rate"] == pytest.approx(1 / 3)
    assert metrics["top3_hit_rate"] == pytest.approx(2 / 3)
    assert metrics["mrr"] == pytest.approx(4 / 9)
    assert metrics_from_ranks([None, None])["top5_hit_rate"] == 0
