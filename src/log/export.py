import json
import re
from dataclasses import asdict
from pathlib import Path

from backend.adapters.local_file_storage import LocalFileStorage
from backend.domain.read_table import read_table

from .errors import RendererUnavailableError, ViewNotFoundError
from .figure_matplotlib import STYLES, draw
from .writer.layout import default_runs_root

BOOKKEEPING = {"samples_seen", "wall_time", "rank", "epoch"}


def figure(view_id: str, path: str, renderer: str = "matplotlib") -> str:
    if renderer not in STYLES:
        raise RendererUnavailableError(f"renderer {renderer!r} is not one of {sorted(STYLES)}")
    table = _view_table(view_id, default_runs_root())
    names = table["column_names"] or []
    x_index = names.index("step") if "step" in names else 0
    series = [
        index for index, name in enumerate(names)
        if index != x_index and re.sub(r"_\d+$", "", name) not in BOOKKEEPING and _numeric(table, index)
    ]
    if not series:
        raise ViewNotFoundError(f"view {view_id!r} has no numeric series to draw")
    lines = []
    for index in series:
        rows = [row for row in table["cells"] if row[index]["value"] != ""]
        lines.append((names[index], [float(row[x_index]["value"]) for row in rows], [float(row[index]["value"]) for row in rows]))
    draw(lines, names[x_index], path, renderer)
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
