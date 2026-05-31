import os
from datetime import datetime
from pathlib import Path


def resolve_run_dir(
    project: str,
    name: str | None,
    runs_root: str | None,
) -> Path:
    if runs_root is None:
        runs_root = os.environ.get("LOG_RUNS_ROOT", "./runs")

    root = Path(runs_root) / project

    if name is None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        hex_suffix = os.urandom(4).hex()
        name = f"{timestamp}-{hex_suffix}"

    run_dir = root / name

    while run_dir.exists():
        hex_suffix = os.urandom(4).hex()
        run_dir = root / f"{name}-{hex_suffix}"

    return run_dir
