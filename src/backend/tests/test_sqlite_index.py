import json

from backend.adapters.sqlite_index import SqliteIndex
from backend.domain.models import RunSummary


def _make_run(runs_root, project, name, status, tags=()):
    run_dir = runs_root / project / name
    run_dir.mkdir(parents=True)
    (run_dir / "meta.json").write_text(
        json.dumps({"status": status, "samples_seen": 7, "tags": list(tags)})
    )
    (run_dir / "config.json").write_text(json.dumps({"params": {"lr": 0.1}}))


def test_rebuild_reads_runs_from_files(tmp_path):
    _make_run(tmp_path, "p1", "run_a", "finished")
    index = SqliteIndex(tmp_path)
    index.rebuild()
    runs = index.query()
    assert len(runs) == 1
    assert runs[0].name == "run_a"
    assert runs[0].samples_seen == 7
    assert runs[0].config == {"lr": 0.1}


def test_query_filters(tmp_path):
    _make_run(tmp_path, "p1", "a", "finished", tags=["baseline"])
    _make_run(tmp_path, "p1", "b", "running")
    _make_run(tmp_path, "p2", "c", "finished")
    index = SqliteIndex(tmp_path)
    index.rebuild()
    assert {r.name for r in index.query(project="p1")} == {"a", "b"}
    assert {r.name for r in index.query(status="finished")} == {"a", "c"}
    assert {r.name for r in index.query(tag="baseline")} == {"a"}


def test_upsert_is_read_back_without_rescan(tmp_path):
    index = SqliteIndex(tmp_path)
    index.upsert(RunSummary("p", "r", "running", 3, None, [], {"lr": 1.0}))
    assert [r.name for r in index.query()] == ["r"]


def test_deleting_the_db_is_safe(tmp_path):
    _make_run(tmp_path, "p1", "a", "finished")
    SqliteIndex(tmp_path).rebuild()
    (tmp_path / ".index.sqlite3").unlink()
    rebuilt = SqliteIndex(tmp_path)
    rebuilt.rebuild()
    assert {r.name for r in rebuilt.query()} == {"a"}
