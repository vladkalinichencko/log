import json

import pytest

from backend.domain.table_engine import ExpressionError, FUNCTIONS, evaluate, parse


def test_aggregation_returns_scalar():
    assert FUNCTIONS["mean"].kind == "aggregation"
    assert FUNCTIONS["mean"].fn([1, 2, 3]) == 2.0


def test_transform_returns_column():
    assert FUNCTIONS["rolling_mean"].kind == "transform"
    assert FUNCTIONS["rolling_mean"].fn([1, 2, 3, 4], 2) == [1.0, 1.5, 2.5, 3.5]


def test_parse_pipeline_shape():
    node = parse("table(p.r.epoch_0000.loss) | select(step,loss)")
    assert node == ("pipe", ("table", "p.r.epoch_0000.loss"), [("select", ["step", "loss"])])


def _series(root, project="p", run="r", name="loss", values=(0.5, 0.1, 0.2)):
    epoch = root / project / run / "epoch_0000"
    epoch.mkdir(parents=True)
    rows = [
        {"step": i, "samples_seen": 0, "wall_time": 1.0, "rank": 0, "scalars": {name: v}}
        for i, v in enumerate(values)
    ]
    (epoch / "metrics.jsonl").write_text("\n".join(json.dumps(r) for r in rows))


def test_filter_select_derive(tmp_path):
    _series(tmp_path, values=(0.5, 0.1, 0.2, 0.9))
    t = evaluate(
        "table(p.r.epoch_0000.loss) | filter(step >= 1) | derive(rm=rolling_mean(loss,2)) | select(step,rm)",
        tmp_path,
    )
    assert t.column_names == ["step", "rm"]
    assert len(t.cells) == 3


def test_agg_groups(tmp_path):
    _series(tmp_path, values=(0.4, 0.2))
    t = evaluate("table(p.r.epoch_0000.loss) | agg(mean, by=rank)", tmp_path)
    assert "loss" in t.column_names
    assert len(t.cells) == 1


def test_join_two_runs(tmp_path):
    _series(tmp_path, run="a", values=(0.5, 0.3))
    _series(tmp_path, run="b", values=(0.4, 0.2))
    t = evaluate(
        "table(p.a.epoch_0000.loss) | join(table(p.b.epoch_0000.loss), on=step)",
        tmp_path,
    )
    assert "loss" in t.column_names and "loss_2" in t.column_names
    assert len(t.cells) == 2


def test_derive_arithmetic(tmp_path):
    _series(tmp_path, values=(0.4, 0.2, 0.1))
    t = evaluate(
        "table(p.r.epoch_0000.loss) | derive(gap = loss - mean(loss)) | select(step,gap)",
        tmp_path,
    )
    gaps = [float(row[1].value) for row in t.cells]
    assert gaps == pytest.approx([0.4 - 0.2333333, 0.2 - 0.2333333, 0.1 - 0.2333333], abs=1e-4)


def test_join_nested_pipeline(tmp_path):
    _series(tmp_path, run="a", values=(0.5, 0.3, 0.7))
    _series(tmp_path, run="b", values=(0.4, 0.2, 0.6))
    t = evaluate(
        "table(p.a.epoch_0000.loss) | join(table(p.b.epoch_0000.loss) | filter(step >= 1), on=step)",
        tmp_path,
    )
    steps = [float(row[0].value) for row in t.cells]
    assert steps == [1.0, 2.0]


def test_bad_expression_raises(tmp_path):
    with pytest.raises(ExpressionError):
        evaluate("notable(x)", tmp_path)
