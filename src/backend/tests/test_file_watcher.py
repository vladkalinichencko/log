from backend.adapters.file_watcher import changed_runs


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


def test_paths_outside_runs_root_ignored(tmp_path):
    assert changed_runs(["/somewhere/else/x.json"], tmp_path) == {}


def test_groups_multiple_runs(tmp_path):
    paths = [
        str(tmp_path / "proj" / "run1" / "meta.json"),
        str(tmp_path / "proj" / "run2" / "meta.json"),
    ]
    assert set(changed_runs(paths, tmp_path)) == {("proj", "run1"), ("proj", "run2")}
