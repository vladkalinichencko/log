import pytest

from backend.domain.table_engine import FUNCTIONS, evaluate, parse


def test_aggregation_returns_scalar():
    assert FUNCTIONS["mean"].kind == "aggregation"
    assert FUNCTIONS["mean"].fn([1, 2, 3]) == 2.0


def test_transform_returns_column():
    assert FUNCTIONS["rolling_mean"].kind == "transform"
    assert FUNCTIONS["rolling_mean"].fn([1, 2, 3, 4], 2) == [1.0, 1.5, 2.5, 3.5]


def test_parser_is_stubbed(tmp_path):
    with pytest.raises(NotImplementedError):
        evaluate("table(p.run.loss)", tmp_path)
    with pytest.raises(NotImplementedError):
        parse("table(p.run.loss)")
