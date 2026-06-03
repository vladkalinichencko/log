import os
from pathlib import Path

from fastapi import Request


def get_runs_root() -> Path:
    return Path(os.environ.get("LOG_RUNS_ROOT", "./runs"))


def get_index(request: Request):
    return request.app.state.index
