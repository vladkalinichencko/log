import os
from pathlib import Path

from fastapi import Depends

from .adapters.sqlite_index import SqliteIndex


def get_runs_root() -> Path:
    return Path(os.environ.get("LOG_RUNS_ROOT", "./runs"))


def get_index(runs_root: Path = Depends(get_runs_root)) -> SqliteIndex:
    index = SqliteIndex(runs_root)
    index.rebuild()
    return index
