import json
from pathlib import Path

from watchfiles import awatch

from ..domain.read_table import DERIVED_STATE_DIRS
from .sqlite_index import read_summary

ALERTS_FILE = "alerts.jsonl"


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

    def __init__(self, runs_root, index, transport):
        self.runs_root = runs_root
        self.index = index
        self.transport = transport
        self.alerts_seen = {path: len(_complete_lines(path)) for path in runs_root.glob(f"*/*/epoch_*/{ALERTS_FILE}")}

    async def run(self) -> None:
        async for changes in awatch(self.runs_root):
            await self.handle([path for _, path in changes])

    async def handle(self, paths: list[str]) -> None:
        for (project, name), kind in changed_runs(paths, self.runs_root).items():
            await self.transport.push(self._record(project, name, kind))
        for changed in map(Path, paths):
            if changed.name == ALERTS_FILE:
                for event in self._new_alerts(changed):
                    await self.transport.push(event)

    def _new_alerts(self, path: Path) -> list[dict]:
        rows = [json.loads(line) for line in _complete_lines(path)]
        seen, self.alerts_seen[path] = self.alerts_seen.get(path, 0), len(rows)
        project, name = path.relative_to(self.runs_root).parts[:2]
        return [{"type": "alert", "run": f"{project}/{name}", "step": row["step"], "rule": row["rule"], "path": row["path"], "message": row["message"]} for row in rows[seen:]]

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
