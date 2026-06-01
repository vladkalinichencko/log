import json

import pytest
from fastapi import HTTPException

from backend.api.runs import get_run, get_runs


def _make_run(runs_root, project, name, status):
    run_dir = runs_root / project / name
    run_dir.mkdir(parents=True)
    (run_dir / "meta.json").write_text(json.dumps({"status": status, "samples_seen": 0}))
    (run_dir / "config.json").write_text(json.dumps({"params": {"lr": 0.1}}))


def _names(rows):
    return {r["name"] for r in rows}


def test_lists_runs_across_projects(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p2", "run_b", "running")
    assert _names(get_runs(tmp_path)) == {"run_a", "run_b"}


def test_project_filter(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p1", "run_b", "running")
    _make_run(tmp_path, "p2", "run_c", "finished")
    assert _names(get_runs(tmp_path, project="p1")) == {"run_a", "run_b"}


def test_status_filter(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    _make_run(tmp_path, "p1", "run_b", "running")
    _make_run(tmp_path, "p2", "run_c", "finished")
    assert _names(get_runs(tmp_path, status="finished")) == {"run_a", "run_c"}


def test_get_run_returns_a_folder_table(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    table = get_run("p1", "run_a", tmp_path)
    assert table["kind"] == "folder"
    assert {c[0]["value"] for c in table["cells"]} >= {"config", "meta"}
    assert "representation" in table and "source_path" in table


def test_get_run_missing_raises_404(tmp_path):
    with pytest.raises(HTTPException):
        get_run("nope", "nope", tmp_path)
