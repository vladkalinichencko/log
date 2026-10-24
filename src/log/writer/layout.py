import os
from datetime import datetime
from pathlib import Path


def default_runs_root() -> Path:
    return Path(os.environ.get("LOG_RUNS_ROOT", "./runs"))


def resolve_run_dir(
    project: str,
    name: str | None,
    runs_root: str | None,
) -> Path:
    root = (Path(runs_root) if runs_root is not None else default_runs_root()) / project

    if name is None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        name = f"{timestamp}-{os.urandom(4).hex()}"

    run_dir = root / name
    while run_dir.exists():
        run_dir = root / f"{name}-{os.urandom(4).hex()}"
    return run_dir
