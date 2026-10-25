import json

import numpy as np

from backend.adapters.local_file_storage import LocalFileStorage
from backend.domain.read_table import read_table


def _storage(root):
    return LocalFileStorage(root)


def test_read_table_runs_root(tmp_path):
    (tmp_path / "test_project").mkdir()
    table = read_table("", _storage(tmp_path))
    assert table.name == "Projects"
    assert table.kind.value == "folder"
    assert [c[0].value for c in table.cells] == ["test_project"]


def _make_run(root):
    run = root / "p" / "r"
    (run / "epoch_0000" / "tensors").mkdir(parents=True)
    (run / "config.json").write_text(json.dumps({"params": {"lr": 0.01}}))
    (run / "meta.json").write_text(json.dumps({"status": "finished", "samples_seen": 0}))
    metrics = [
        {"step": 0, "samples_seen": 0, "wall_time": 1.0, "rank": 0, "scalars": {"loss": 2.0}},
        {"step": 1, "samples_seen": 0, "wall_time": 2.0, "rank": 0, "scalars": {"loss": 1.0}},
    ]
    (run / "epoch_0000" / "metrics.jsonl").write_text(
        "\n".join(json.dumps(m) for m in metrics)
    )
    np.save(run / "epoch_0000" / "tensors" / "w__step000000000.npy", np.arange(6).reshape(2, 3))
    (run / "epoch_0000" / "tensors" / "index.jsonl").write_text(
        json.dumps({"path": "w", "step": 0, "file": "w__step000000000.npy", "shape": [2, 3], "dtype": "int64"})
    )


def test_drill_run_to_scalar(tmp_path):
    _make_run(tmp_path)
    run = read_table("p.r", _storage(tmp_path))
    assert {c[0].value for c in run.cells} == {"config", "meta", "metrics", "epoch_0000"}

    epoch = read_table("p.r.epoch_0000", _storage(tmp_path))
    assert {c[0].value for c in epoch.cells} == {"loss", "w"}

    series = read_table("p.r.epoch_0000.loss", _storage(tmp_path))
    assert series.kind.value == "column"
    assert series.column_names == ["step", "samples_seen", "wall_time", "rank", "loss"]
    assert [r[-1].value for r in series.cells] == ["2.0", "1.0"]


def test_run_metrics_table_spans_epochs_with_gaps_left_empty(tmp_path):
    _make_run(tmp_path)
    epoch_1 = tmp_path / "p" / "r" / "epoch_0001"
    epoch_1.mkdir()
    (epoch_1 / "metrics.jsonl").write_text(json.dumps(
        {"step": 2, "samples_seen": 0, "wall_time": 3.0, "rank": 0, "scalars": {"loss": 0.5, "acc": 0.9}}
    ))
    metrics = read_table("p.r.metrics", _storage(tmp_path))
    assert metrics.column_names == ["step", "epoch", "wall_time", "rank", "loss", "acc"]
    assert [[c.value for c in r][:2] + [c.value for c in r][3:] for r in metrics.cells] == [
        ["0", "0", "0", "2.0", ""],
        ["1", "0", "0", "1.0", ""],
        ["2", "1", "0", "0.5", "0.9"],
    ]
    assert metrics.cells[2][2].value == "3.0"
    assert metrics.cells[0][5].type.value == "empty"


def test_drill_tensor(tmp_path):
    _make_run(tmp_path)
    t = read_table("p.r.epoch_0000.w", _storage(tmp_path))
    assert t.kind.value == "grid"
    assert [[c.value for c in r] for r in t.cells] == [["0", "1", "2"], ["3", "4", "5"]]


def test_config_keyvalue(tmp_path):
    _make_run(tmp_path)
    cfg = read_table("p.r.config", _storage(tmp_path))
    assert cfg.column_names == ["key", "value"]
    assert [[c.value for c in r] for r in cfg.cells] == [["lr", "0.01"]]


def test_list_paths_walks_tree(tmp_path):
    from backend.api.tables import list_paths

    _make_run(tmp_path)
    paths = list_paths(_storage(tmp_path))
    assert {"p", "p.r", "p.r.epoch_0000", "p.r.epoch_0000.loss", "p.r.epoch_0000.w"} <= set(paths)


def test_boolean_scalars_are_bool_cells_not_numbers(tmp_path):
    _make_run(tmp_path)
    (tmp_path / "p" / "r" / "epoch_0000" / "metrics.jsonl").write_text(json.dumps(
        {"step": 0, "samples_seen": 0, "wall_time": 1.0, "rank": 0, "scalars": {"done": True}}
    ))
    leaf = read_table("p.r.epoch_0000.done", _storage(tmp_path))
    metrics = read_table("p.r.metrics", _storage(tmp_path))
    assert (leaf.cells[0][-1].type.value, leaf.cells[0][-1].value) == ("bool", "True")
    assert (metrics.cells[0][-1].type.value, metrics.cells[0][-1].value) == ("bool", "True")
    assert leaf.cells[0][0].type.value == "number"


def test_project_table_pulls_status_start_and_duration_up_from_each_run(tmp_path):
    for name, meta in {
        "done": {"status": "finished", "samples_seen": 8, "start_wall_time": 100.0, "end_wall_time": 160.5},
        "live": {"status": "running", "samples_seen": 2, "start_wall_time": 1.0},
        "old": {"status": "finished", "samples_seen": 0, "start_wall_time": 5.0},
    }.items():
        (tmp_path / "p" / name).mkdir(parents=True)
        (tmp_path / "p" / name / "meta.json").write_text(json.dumps(meta))
    project = read_table("p", _storage(tmp_path))
    assert project.column_names == ["run", "status", "started", "duration", "samples_seen"]
    rows = {row[0].value: [c.value for c in row[1:]] for row in project.cells}
    assert rows["done"] == ["finished", "100.0", "60.5", "8"]
    assert float(rows["live"][2]) > 1_000_000
    assert rows["old"] == ["finished", "5.0", "", "0"]
