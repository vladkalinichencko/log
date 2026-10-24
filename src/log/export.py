import json
import re
from dataclasses import asdict
from pathlib import Path

from backend.adapters.local_file_storage import LocalFileStorage
from backend.domain.read_table import read_table

from .errors import RendererUnavailableError, ViewNotFoundError
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

BOOKKEEPING = {"samples_seen", "wall_time", "rank", "epoch"}


def figure(view_id: str, path: str, renderer: str = "matplotlib") -> str:
    if renderer not in RENDERER_STYLES:
        raise RendererUnavailableError(f"renderer {renderer!r} is not one of {sorted(RENDERER_STYLES)}")
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as e:
        raise RendererUnavailableError(f"renderer {renderer!r} unavailable: {e}") from e

    table = _view_table(view_id, default_runs_root())
    names = table["column_names"] or []
    x_index = names.index("step") if "step" in names else 0
    series = [
        index for index, name in enumerate(names)
        if index != x_index and re.sub(r"_\d+$", "", name) not in BOOKKEEPING and _numeric(table, index)
    ]
    if not series:
        raise ViewNotFoundError(f"view {view_id!r} has no numeric series to draw")

    with plt.rc_context(RENDERER_STYLES[renderer]):
        figure_, axes = plt.subplots()
        for index in series:
            rows = [row for row in table["cells"] if row[index]["value"] != ""]
            axes.plot([float(row[x_index]["value"]) for row in rows], [float(row[index]["value"]) for row in rows], label=names[index])
        axes.set_xlabel(names[x_index])
        if len(series) > 1:
            axes.legend()
        else:
            axes.set_ylabel(names[series[0]])
        figure_.savefig(path, bbox_inches="tight")
        plt.close(figure_)
    return str(Path(path).resolve())


def _view_table(view_id: str, runs_root: Path) -> dict:
    saved = runs_root / "views" / f"{view_id}.json"
    if saved.exists():
        return json.loads(saved.read_text())
    try:
        return asdict(read_table(view_id, LocalFileStorage(runs_root)))
    except FileNotFoundError as error:
        raise ViewNotFoundError(f"view {view_id!r} not found") from error


def _numeric(table: dict, index: int) -> bool:
    values = [row[index] for row in table["cells"] if row[index]["value"] != ""]
    return bool(values) and all(cell["type"] == "number" for cell in values)
