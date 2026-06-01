from backend.api.ws import _runs_changed


def test_runs_changed_groups_by_run_and_skips_workspaces(tmp_path):
    def p(*parts):
        return str(tmp_path.joinpath(*parts))

    changed = [
        p("proj", "run1", "epoch_0000", "metrics.jsonl"),
        p("proj", "run1", "meta.json"),
        p("proj", "run2", "meta.json"),
        p("workspaces", "default.json"),
    ]
    assert _runs_changed(changed, tmp_path) == {"proj/run1", "proj/run2"}


def test_runs_changed_ignores_paths_outside_runs_root(tmp_path):
    assert _runs_changed(["/somewhere/else/x.json"], tmp_path) == set()
