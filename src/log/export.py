import json
import os
from pathlib import Path

from .errors import RendererUnavailableError, ViewNotFoundError


def _runs_root() -> Path:
    return Path(os.environ.get("LOG_RUNS_ROOT", "./runs"))


def figure(view_id: str, path: str, renderer: str = "matplotlib") -> str:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as e:
        raise RendererUnavailableError(f"renderer {renderer!r} unavailable: {e}") from e

    segments = view_id.split(".")
    if len(segments) < 4:
        raise ViewNotFoundError(f"view {view_id!r} is not a scalar series path")
    project, run, epoch = segments[0], segments[1], segments[2]
    scalar = ".".join(segments[3:])
    metrics_path = _runs_root() / project / run / epoch / "metrics.jsonl"
    if not metrics_path.exists():
        raise ViewNotFoundError(f"view {view_id!r} not found")

    xs, ys = [], []
    for line in metrics_path.read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            if scalar in row.get("scalars", {}):
                xs.append(row["step"])
                ys.append(row["scalars"][scalar])
    if not xs:
        raise ViewNotFoundError(f"view {view_id!r} has no series {scalar!r}")

    figure_, axes = plt.subplots()
    axes.plot(xs, ys)
    axes.set_xlabel("step")
    axes.set_ylabel(scalar)
    figure_.savefig(path)
    plt.close(figure_)
    return path
