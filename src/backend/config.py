import os
from pathlib import Path

from fastapi import Depends, Request

from .adapters.local_file_storage import LocalFileStorage
from .domain import table_engine


def get_runs_root() -> Path:
    return Path(os.environ.get("LOG_RUNS_ROOT", "./runs")).resolve()


def get_storage(runs_root: Path = Depends(get_runs_root)) -> LocalFileStorage:
    return LocalFileStorage(runs_root)


def get_index(request: Request):
    return request.app.state.index


def get_push(request: Request):
    return request.app.state.push


def get_engine():
    return table_engine
