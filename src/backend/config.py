import os
from pathlib import Path


def get_runs_root() -> Path:
    """Resolve the runs root directory."""
    return Path(os.environ.get("LOG_RUNS_ROOT", "./runs"))
