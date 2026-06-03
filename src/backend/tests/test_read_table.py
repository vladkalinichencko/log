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
    assert {c[0].value for c in run.cells} == {"config", "meta", "epoch_0000"}

    epoch = read_table("p.r.epoch_0000", _storage(tmp_path))
    assert {c[0].value for c in epoch.cells} == {"loss", "w"}

    series = read_table("p.r.epoch_0000.loss", _storage(tmp_path))
    assert series.kind.value == "column"
    assert series.column_names == ["step", "samples_seen", "wall_time", "rank", "loss"]
    assert [r[-1].value for r in series.cells] == ["2.0", "1.0"]


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
