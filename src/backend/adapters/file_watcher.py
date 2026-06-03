from pathlib import Path

from watchfiles import awatch

from .sqlite_index import read_summary


def _classify(rest: tuple[str, ...]) -> str:
    if "tensors" in rest:
        return "tensor"
    if "checkpoints" in rest:
        return "checkpoint"
    if rest == ("meta.json",):
        return "meta"
    return "metrics"


def changed_runs(paths: list[str], runs_root: Path) -> dict[tuple[str, str], str]:
    runs = {}
    for changed in paths:
        try:
            parts = Path(changed).relative_to(runs_root).parts
        except ValueError:
            continue
        if len(parts) >= 2 and parts[0] != "workspaces":
            runs[(parts[0], parts[1])] = _classify(parts[2:])
    return runs


class FileWatcher:

    def __init__(self, runs_root, index, transport):
        self.runs_root = runs_root
        self.index = index
        self.transport = transport

    async def run(self) -> None:
        async for changes in awatch(self.runs_root):
            for (project, name), kind in changed_runs([p for _, p in changes], self.runs_root).items():
                if (self.runs_root / project / name).is_dir():
                    self.index.upsert(read_summary(self.runs_root, project, name))
                else:
                    self.index.rebuild()
                await self.transport.push(
                    {"type": "run_updated", "run": f"{project}/{name}", "kind": kind}
                )
