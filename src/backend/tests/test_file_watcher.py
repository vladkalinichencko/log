import asyncio
import json
import shutil

from backend.adapters.file_watcher import FileWatcher, changed_runs
from backend.adapters.sqlite_index import SqliteIndex


class RecordingTransport:
    def __init__(self):
        self.events = []

    async def push(self, event):
        self.events.append(event)


def test_watcher_reports_a_new_run_then_its_updates_then_its_removal(tmp_path):
    index = SqliteIndex(tmp_path)
    index.rebuild()
    transport = RecordingTransport()
    watcher = FileWatcher(tmp_path, index, [transport])
    run = tmp_path / "p" / "r"
    run.mkdir(parents=True)
    (run / "meta.json").write_text(json.dumps({"status": "running", "samples_seen": 0}))

    asyncio.run(watcher.handle([str(run / "meta.json")]))
    asyncio.run(watcher.handle([str(run / "epoch_0000" / "metrics.jsonl")]))
    shutil.rmtree(run)
    asyncio.run(watcher.handle([str(run)]))

    assert transport.events == [
        {"type": "run_added", "run": "p/r"},
        {"type": "run_updated", "run": "p/r", "kind": "metrics"},
        {"type": "run_removed", "run": "p/r"},
    ]
    assert index.query("p", None, None) == []


def _kind(path, runs_root):
    return changed_runs([str(path)], runs_root)[("p", "r")]


def test_classifies_each_change_kind(tmp_path):
    assert _kind(tmp_path / "p" / "r" / "epoch_0000" / "metrics.jsonl", tmp_path) == "metrics"
    assert _kind(tmp_path / "p" / "r" / "epoch_0000" / "tensors" / "x.npy", tmp_path) == "tensor"
    assert _kind(tmp_path / "p" / "r" / "meta.json", tmp_path) == "meta"
    assert _kind(tmp_path / "p" / "r" / "checkpoints" / "index.jsonl", tmp_path) == "checkpoint"


def test_saved_views_and_workspaces_are_not_run_changes(tmp_path):
    paths = [str(tmp_path / "workspaces" / "w.json"), str(tmp_path / "views" / "p.r.config.json")]
    assert changed_runs(paths, tmp_path) == {}


def test_project_level_files_are_not_runs(tmp_path):
    paths = [str(tmp_path / "p" / "project.json"), str(tmp_path / "p" / "project.json.tmp")]
    assert changed_runs(paths, tmp_path) == {}


def test_paths_outside_runs_root_ignored(tmp_path):
    assert changed_runs(["/somewhere/else/x.json"], tmp_path) == {}


def test_groups_multiple_runs(tmp_path):
    paths = [
        str(tmp_path / "proj" / "run1" / "meta.json"),
        str(tmp_path / "proj" / "run2" / "meta.json"),
    ]
    assert set(changed_runs(paths, tmp_path)) == {("proj", "run1"), ("proj", "run2")}


def test_watcher_pushes_each_new_alert_row_once_and_not_the_rows_it_found_at_start(tmp_path):
    index = SqliteIndex(tmp_path)
    run = tmp_path / "p" / "r"
    (run / "epoch_0000").mkdir(parents=True)
    (run / "meta.json").write_text(json.dumps({"status": "running", "samples_seen": 0}))
    alerts = run / "epoch_0000" / "alerts.jsonl"
    old = {"step": 1, "wall_time": 1.0, "rank": 0, "rule": "spike", "path": "loss", "value": 9.0, "message": "old"}
    alerts.write_text(json.dumps(old) + "\n")
    index.rebuild()
    transport = RecordingTransport()
    watcher = FileWatcher(tmp_path, index, [transport])
    new = {**old, "step": 2, "rule": "non_finite", "value": float("nan"), "message": "became nan"}

    alerts.write_text(alerts.read_text() + json.dumps(new) + "\n" + '{"step": 3, "wall')
    asyncio.run(watcher.handle([str(alerts)]))
    asyncio.run(watcher.handle([str(alerts)]))

    assert [event for event in transport.events if event["type"] == "alert"] == [
        {"type": "alert", "run": "p/r", "step": 2, "rule": "non_finite", "path": "loss", "message": "became nan", "text": "p.r: loss became nan at step 2"},
    ]
    assert transport.events[0] == {"type": "run_updated", "run": "p/r", "kind": "alert"}
