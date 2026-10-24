import json
import sqlite3
import threading
from pathlib import Path

from ..domain.models import RunSummary

_COLUMNS = "project, name, status, samples_seen, start_wall_time, tags, config"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def read_summary(runs_root: Path, project: str, name: str) -> RunSummary:
    run_dir = runs_root / project / name
    meta = _read_json(run_dir / "meta.json")
    config = _read_json(run_dir / "config.json")
    return RunSummary(
        project=project,
        name=name,
        status=meta.get("status", "unknown"),
        samples_seen=meta.get("samples_seen", 0),
        start_wall_time=meta.get("start_wall_time"),
        tags=meta.get("tags", []),
        config=config.get("params", {}),
    )


def _scan_runs(runs_root: Path) -> list[RunSummary]:
    summaries = []
    if not runs_root.exists():
        return summaries
    for project_dir in runs_root.iterdir():
        if not project_dir.is_dir() or project_dir.name.startswith("."):
            continue
        for run_dir in project_dir.iterdir():
            if run_dir.is_dir() and not run_dir.name.startswith("."):
                summaries.append(read_summary(runs_root, project_dir.name, run_dir.name))
    return summaries


def _to_summary(row) -> RunSummary:
    project, name, status, samples_seen, start_wall_time, tags, config = row
    return RunSummary(project, name, status, samples_seen, start_wall_time, json.loads(tags), json.loads(config))


class SqliteIndex:

    def __init__(self, runs_root: Path):
        self.runs_root = runs_root
        runs_root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.connection = sqlite3.connect(runs_root / ".index.sqlite3", check_same_thread=False)
        with self.lock:
            self.connection.execute(
                f"CREATE TABLE IF NOT EXISTS runs ({_COLUMNS}, PRIMARY KEY (project, name))"
            )

    def upsert(self, run: RunSummary) -> None:
        with self.lock:
            self.connection.execute(
                f"INSERT OR REPLACE INTO runs ({_COLUMNS}) VALUES (?,?,?,?,?,?,?)",
                (run.project, run.name, run.status, run.samples_seen,
                 run.start_wall_time, json.dumps(run.tags), json.dumps(run.config)),
            )
            self.connection.commit()

    def rebuild(self) -> None:
        with self.lock:
            self.connection.execute("DELETE FROM runs")
            self.connection.commit()
        for run in _scan_runs(self.runs_root):
            self.upsert(run)

    def query(self, project: str | None = None, status: str | None = None, tag: str | None = None) -> list[RunSummary]:
        with self.lock:
            rows = self.connection.execute(
                f"SELECT {_COLUMNS} FROM runs WHERE (?1 IS NULL OR project = ?1) AND (?2 IS NULL OR status = ?2)",
                (project, status),
            ).fetchall()
        return [run for run in map(_to_summary, rows) if tag is None or tag in run.tags]
