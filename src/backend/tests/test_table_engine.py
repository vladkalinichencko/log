import json

import pytest

from backend.adapters.local_file_storage import LocalFileStorage
from backend.domain.table_engine import ExpressionError, FUNCTIONS, evaluate, parse


def _eval(expression, root):
    return evaluate(expression, LocalFileStorage(root))


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
    t = _eval(
        "table(p.r.epoch_0000.loss) | filter(step >= 1) | derive(rm=rolling_mean(loss,2)) | select(step,rm)",
        tmp_path,
    )
    assert t.column_names == ["step", "rm"]
    assert len(t.cells) == 3


def test_agg_groups(tmp_path):
    _series(tmp_path, values=(0.4, 0.2))
    t = _eval("table(p.r.epoch_0000.loss) | agg(mean, by=rank)", tmp_path)
    assert "loss" in t.column_names
    assert len(t.cells) == 1


def test_join_two_runs(tmp_path):
    _series(tmp_path, run="a", values=(0.5, 0.3))
    _series(tmp_path, run="b", values=(0.4, 0.2))
    t = _eval(
        "table(p.a.epoch_0000.loss) | join(table(p.b.epoch_0000.loss), on=step)",
        tmp_path,
    )
    assert "loss" in t.column_names and "loss_2" in t.column_names
    assert len(t.cells) == 2


def test_derive_arithmetic(tmp_path):
    _series(tmp_path, values=(0.4, 0.2, 0.1))
    t = _eval(
        "table(p.r.epoch_0000.loss) | derive(gap = loss - mean(loss)) | select(step,gap)",
        tmp_path,
    )
    gaps = [float(row[1].value) for row in t.cells]
    assert gaps == pytest.approx([0.4 - 0.2333333, 0.2 - 0.2333333, 0.1 - 0.2333333], abs=1e-4)


def test_join_nested_pipeline(tmp_path):
    _series(tmp_path, run="a", values=(0.5, 0.3, 0.7))
    _series(tmp_path, run="b", values=(0.4, 0.2, 0.6))
    t = _eval(
        "table(p.a.epoch_0000.loss) | join(table(p.b.epoch_0000.loss) | filter(step >= 1), on=step)",
        tmp_path,
    )
    steps = [float(row[0].value) for row in t.cells]
    assert steps == [1.0, 2.0]


def test_bad_expression_raises(tmp_path):
    with pytest.raises(ExpressionError):
        _eval("notable(x)", tmp_path)


def test_statistics_registry_additions():
    assert FUNCTIONS["median"].fn([1, 2, 9]) == 2.0
    assert FUNCTIONS["var"].fn([1, 1, 1]) == 0.0
    assert FUNCTIONS["norm"].fn([3, 4]) == 5.0
    assert FUNCTIONS["cumsum"].fn([1, 2, 3]) == [1, 3, 6]
    assert FUNCTIONS["diff"].fn([1, 4, 9]) == [0, 3, 5]


def test_derive_with_new_statistics(tmp_path):
    _series(tmp_path, values=(1.0, 4.0, 9.0))
    t = _eval("table(p.r.epoch_0000.loss) | derive(d = diff(loss)) | select(step, d)", tmp_path)
    assert [row[1].value for row in t.cells] == ["0.0", "3.0", "5.0"]
    assert t.column_names == ["step", "d"]


def test_functions_endpoint_mirrors_registry():
    from fastapi.testclient import TestClient

    from backend.main import app

    listed = {f["name"]: f for f in TestClient(app).get("/api/tables/functions").json()}
    assert listed.keys() == FUNCTIONS.keys()
    assert listed["mean"] == {"name": "mean", "kind": "aggregation", "windowed": False}
    assert listed["rolling_mean"] == {"name": "rolling_mean", "kind": "transform", "windowed": True}


def _metrics(root, run, rows):
    epoch = root / "p" / run / "epoch_0000"
    epoch.mkdir(parents=True)
    (root / "p" / run / "meta.json").write_text(json.dumps({"status": "finished", "samples_seen": 0}))
    (epoch / "metrics.jsonl").write_text("\n".join(json.dumps({"samples_seen": 0, "wall_time": 1.0, "rank": 0, **row}) for row in rows))


def _route(expression, root, monkeypatch):
    from fastapi.testclient import TestClient

    from backend.main import app

    monkeypatch.setenv("LOG_RUNS_ROOT", str(root))
    response = TestClient(app).post("/api/tables/eval", json={"expression": expression})
    body = response.json()
    if response.status_code != 200:
        return body["error"]["message"]
    return body["column_names"], [[cell["value"] for cell in row] for row in body["cells"]]


def test_overlay_puts_one_metric_of_many_runs_side_by_side_on_every_step_any_of_them_logged(tmp_path, monkeypatch):
    _metrics(tmp_path, "a", [{"step": 0, "scalars": {"loss": 2.0}}, {"step": 2, "scalars": {"loss": 1.0, "acc": 0.5}}])
    _metrics(tmp_path, "b", [{"step": 1, "scalars": {"loss": 3.0}}, {"step": 2, "scalars": {"loss": 1.5}}])
    assert _route("overlay(loss, p.a, p.b)", tmp_path, monkeypatch) == (
        ["step", "p.a", "p.b"],
        [["0.0", "2.0", ""], ["1.0", "", "3.0"], ["2.0", "1.0", "1.5"]],
    )
    assert _route("overlay(acc, p.a)", tmp_path, monkeypatch)[1] == [["2.0", "0.5"]]
    assert _route("overlay(acc, p.a, p.b)", tmp_path, monkeypatch) == "p.b has no column 'acc'"
    assert _route("overlay(loss, p.a) | filter(step > 0)", tmp_path, monkeypatch)[1] == [["2.0", "1.0"]]


def test_splice_continues_a_run_with_the_run_resumed_from_it_and_names_each_segment(tmp_path, monkeypatch):
    _metrics(tmp_path, "a", [{"step": step, "scalars": {"loss": 10.0 - step}} for step in range(4)])
    _metrics(tmp_path, "b", [{"step": step, "scalars": {"loss": 20.0 - step, "lr": 0.1}} for step in (2, 3, 4)])
    names, rows = _route("splice(p.a, p.b)", tmp_path, monkeypatch)
    assert names == ["step", "epoch", "wall_time", "rank", "loss", "lr", "segment"]
    assert [(row[0], row[4], row[5], row[6]) for row in rows] == [
        ("0.0", "10.0", "", "p.a"), ("1.0", "9.0", "", "p.a"),
        ("2.0", "18.0", "0.1", "p.b"), ("3.0", "17.0", "0.1", "p.b"), ("4.0", "16.0", "0.1", "p.b"),
    ]
    assert _route("splice(p.a)", tmp_path, monkeypatch).startswith("splice takes two runs")


def test_a_quoted_name_reaches_metrics_logged_with_slashes(tmp_path, monkeypatch):
    _metrics(tmp_path, "a", [{"step": 0, "scalars": {"train/loss": 2.0}}, {"step": 1, "scalars": {"train/loss": 1.0}}])
    assert _route('overlay("train/loss", p.a)', tmp_path, monkeypatch) == (["step", "p.a"], [["0.0", "2.0"], ["1.0", "1.0"]])
    assert _route('table(p.a.metrics) | select(step, "train/loss")', tmp_path, monkeypatch)[0] == ["step", "train/loss"]


def test_a_statistic_on_a_slash_named_metric_evaluates_from_its_quoted_formula(tmp_path, monkeypatch):
    _metrics(tmp_path, "a", [{"step": step, "scalars": {"train/loss": float(step)}} for step in range(3)])
    names, rows = _route('table(p.a.metrics) | derive("zscore_train/loss" = zscore("train/loss", 2)) | select(step, "zscore_train/loss")', tmp_path, monkeypatch)
    assert names == ["step", "zscore_train/loss"] and len(rows) == 3
