from pathlib import Path

from .errors import RendererUnavailableError, ViewNotFoundError
from .writer.atomic import read_jsonl
from .writer.layout import default_runs_root

MILLIMETRE = 1 / 25.4

RENDERER_STYLES = {
    "matplotlib": {},
    "nature": {
        "figure.figsize": (89 * MILLIMETRE, 60 * MILLIMETRE),
        "savefig.dpi": 300,
        "font.family": "sans-serif",
        "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
        "font.size": 7,
        "axes.labelsize": 7,
        "xtick.labelsize": 6,
        "ytick.labelsize": 6,
        "axes.linewidth": 0.5,
        "lines.linewidth": 1.0,
        "xtick.major.width": 0.5,
        "ytick.major.width": 0.5,
        "axes.spines.top": False,
        "axes.spines.right": False,
    },
}


def figure(view_id: str, path: str, renderer: str = "matplotlib") -> str:
    if renderer not in RENDERER_STYLES:
        raise RendererUnavailableError(f"renderer {renderer!r} is not one of {sorted(RENDERER_STYLES)}")
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
    metrics_path = default_runs_root() / project / run / epoch / "metrics.jsonl"
    if not metrics_path.exists():
        raise ViewNotFoundError(f"view {view_id!r} not found")

    rows = [row for row in read_jsonl(metrics_path) if scalar in row.get("scalars", {})]
    xs = [row["step"] for row in rows]
    ys = [row["scalars"][scalar] for row in rows]
    if not xs:
        raise ViewNotFoundError(f"view {view_id!r} has no series {scalar!r}")

    with plt.rc_context(RENDERER_STYLES[renderer]):
        figure_, axes = plt.subplots()
        axes.plot(xs, ys)
        axes.set_xlabel("step")
        axes.set_ylabel(scalar)
        figure_.savefig(path, bbox_inches="tight")
        plt.close(figure_)
    return str(Path(path).resolve())
