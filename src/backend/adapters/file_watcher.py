import asyncio
import json
from pathlib import Path

from watchfiles import awatch

from ..domain.read_table import DERIVED_STATE_DIRS, read_table
from .local_file_storage import LocalFileStorage
from .sqlite_index import read_summary

ALERTS_FILE = "alerts.jsonl"
HEARTBEAT_CHECK_SECONDS = 60


def _classify(rest: tuple[str, ...]) -> str:
    if "tensors" in rest:
        return "tensor"
    if "checkpoints" in rest:
        return "checkpoint"
    if rest == ("meta.json",):
        return "meta"
    if rest[-1:] == (ALERTS_FILE,):
        return "alert"
    return "metrics"


def changed_runs(paths: list[str], runs_root: Path) -> dict[tuple[str, str], str]:
    runs = {}
    for changed in paths:
        try:
            parts = Path(changed).relative_to(runs_root).parts
        except ValueError:
            continue
        if len(parts) >= 2 and parts[0] not in DERIVED_STATE_DIRS and "." not in parts[1]:
            runs[(parts[0], parts[1])] = _classify(parts[2:])
    return runs


class FileWatcher:

    def __init__(self, runs_root, index, transports):
        self.runs_root = runs_root
        self.index = index
        self.transports = transports
        self.silent_runs: set[str] = set()
        self.alerts_seen = {path: len(_complete_lines(path)) for path in runs_root.glob(f"*/*/epoch_*/{ALERTS_FILE}")}

    async def run(self) -> None:
        async for changes in awatch(self.runs_root):
            await self.handle([path for _, path in changes])

    async def handle(self, paths: list[str]) -> None:
        for (project, name), kind in changed_runs(paths, self.runs_root).items():
            await self._push(self._record(project, name, kind))
        for changed in map(Path, paths):
            if changed.name == ALERTS_FILE:
                for event in self._new_alerts(changed):
                    await self._push(event)

    async def watch_heartbeats(self) -> None:
        while True:
            await asyncio.sleep(HEARTBEAT_CHECK_SECONDS)
            await self.check_heartbeats()

    async def check_heartbeats(self) -> None:
        storage = LocalFileStorage(self.runs_root)
        for summary in self.index.query(None, "running", None):
            run = f"{summary.project}/{summary.name}"
            alerts = read_table(f"{summary.project}.{summary.name}.alerts", storage)
            columns = alerts.column_names or []
            rows = [dict(zip(columns, (cell.value for cell in row))) for row in alerts.cells]
            heartbeat = next((row for row in rows if row["rule"] == "heartbeat"), None)
            if heartbeat is None:
                self.silent_runs.discard(run)
            elif run not in self.silent_runs:
                self.silent_runs.add(run)
                await self._push(alert_event(run, {**heartbeat, "step": int(heartbeat["step"]) if heartbeat["step"] else None}))

    async def _push(self, event: dict) -> None:
        for transport in self.transports:
            await transport.push(event)

    def _new_alerts(self, path: Path) -> list[dict]:
        rows = [json.loads(line) for line in _complete_lines(path)]
        seen, self.alerts_seen[path] = self.alerts_seen.get(path, 0), len(rows)
        project, name = path.relative_to(self.runs_root).parts[:2]
        return [alert_event(f"{project}/{name}", row) for row in rows[seen:]]

    def _record(self, project: str, name: str, kind: str) -> dict:
        run = f"{project}/{name}"
        if not (self.runs_root / project / name).is_dir():
            self.index.rebuild()
            return {"type": "run_removed", "run": run}
        known = any(summary.name == name for summary in self.index.query(project, None, None))
        self.index.upsert(read_summary(self.runs_root, project, name))
        return {"type": "run_updated", "run": run, "kind": kind} if known else {"type": "run_added", "run": run}


def _complete_lines(path: Path) -> list[str]:
    return path.read_text().split("\n")[:-1] if path.exists() else []


def alert_event(run: str, row: dict) -> dict:
    at_step = "" if row["step"] is None else f" at step {row['step']}"
    text = f"{run.replace('/', '.')}: {row['path']} {row['message']}{at_step}"
    return {"type": "alert", "run": run, "step": row["step"], "rule": row["rule"], "path": row["path"], "message": row["message"], "text": text}
