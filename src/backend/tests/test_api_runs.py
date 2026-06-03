import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.adapters.sqlite_index import SqliteIndex
from backend.main import app
from backend.api.runs import (
    RenameRequest,
    delete_run,
    get_run,
    get_runs,
    rename_names,
    rename_runs,
)


def _make_run(runs_root, project, name, status):
    run_dir = runs_root / project / name
    run_dir.mkdir(parents=True)
    (run_dir / "meta.json").write_text(json.dumps({"status": status, "samples_seen": 0}))
    (run_dir / "config.json").write_text(json.dumps({"params": {"lr": 0.1}}))


def _index(runs_root):
    index = SqliteIndex(runs_root)
    index.rebuild()
    return index


def _names(rows):
    return {r["name"] for r in rows}


def test_lists_runs_across_projects(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p2", "run_b", "running")
    assert _names(get_runs(_index(tmp_path))) == {"run_a", "run_b"}


def test_project_filter(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p1", "run_b", "running")
    _make_run(tmp_path, "p2", "run_c", "finished")
    assert _names(get_runs(_index(tmp_path), project="p1")) == {"run_a", "run_b"}


def test_status_filter(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p1", "run_b", "running")
    _make_run(tmp_path, "p2", "run_c", "finished")
    assert _names(get_runs(_index(tmp_path), status="finished")) == {"run_a", "run_c"}


def test_get_run_returns_a_folder_table(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    table = get_run("p1", "run_a", tmp_path)
    assert table["kind"] == "folder"
    assert {c[0]["value"] for c in table["cells"]} >= {"config", "meta"}
    assert "representation" in table and "source_path" in table


def test_get_run_missing_raises_404(tmp_path):
    with pytest.raises(HTTPException):
        get_run("nope", "nope", tmp_path)


def test_delete_run_removes_dir(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    delete_run("p1", "run_a", tmp_path)
    assert not (tmp_path / "p1" / "run_a").exists()


def test_delete_run_missing_raises_404(tmp_path):
    with pytest.raises(HTTPException):
        delete_run("nope", "nope", tmp_path)


def test_rename_names_finder_style():
    assert rename_names(["loss"], prefix="exp_") == ["exp_loss"]
    assert rename_names(["loss"], suffix="_v2") == ["loss_v2"]
    assert rename_names(["run_tmp_a"], find="tmp_", replace="") == ["run_a"]


def test_rename_runs_moves_dirs(tmp_path):
    _make_run(tmp_path, "p1", "a", "finished")
    _make_run(tmp_path, "p1", "b", "finished")
    out = rename_runs(RenameRequest(run_refs=["p1/a", "p1/b"], prefix="exp_"), tmp_path)
    assert out["renamed"] == {"p1/a": "p1/exp_a", "p1/b": "p1/exp_b"}
    assert (tmp_path / "p1" / "exp_a").is_dir()
    assert not (tmp_path / "p1" / "a").exists()


def test_rename_runs_collision_raises(tmp_path):
    _make_run(tmp_path, "p1", "a", "finished")
    _make_run(tmp_path, "p1", "exp_a", "finished")
    with pytest.raises(HTTPException):
        rename_runs(RenameRequest(run_refs=["p1/a"], prefix="exp_"), tmp_path)


def test_route_status_filter_through_index(tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_RUNS_ROOT", str(tmp_path))
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p1", "run_b", "running")
    rows = TestClient(app).get("/api/runs", params={"status": "finished"}).json()
    assert {r["name"] for r in rows} == {"run_a"}
