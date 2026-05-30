import pytest

from backend.domain.table_engine import evaluate, parse

# Stage 0: the merge language is stubbed (§3.1, §14). These tests pin that the
# public surface exists with the right signatures and is honestly unimplemented,
# and become real behavior tests when the engine lands (§9.13).


def test_evaluate_is_stubbed(tmp_path):
    with pytest.raises(NotImplementedError):
        evaluate("table(p.run.loss)", tmp_path)


def test_parse_is_stubbed():
    with pytest.raises(NotImplementedError):
        parse("table(p.run.loss)")
