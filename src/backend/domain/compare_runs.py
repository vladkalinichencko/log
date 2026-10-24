import json

from ..ports.storage_port import StoragePort
from .models import Cell, CellType, Table, TableKind
from .read_table import epochs, read_json, read_jsonl


def compare_runs(paths: list[str], storage: StoragePort) -> Table:
    if len(paths) < 2:
        raise ValueError("at least two runs are required")
    runs = {path: _run_values(path, storage) for path in paths}
    keys = sorted({key for values in runs.values() for key in values})
    return Table(
        name="run comparison",
        kind=TableKind.grid,
        column_names=["section", "key", *paths],
        cells=[
            [_cell(section), _cell(key), *[_cell(runs[path].get((section, key))) for path in paths]]
            for section, key in keys
        ],
        source_path=None,
    )


def _run_values(path: str, storage: StoragePort) -> dict[tuple[str, str], object]:
    run_dir = path.replace(".", "/")
    if not storage.exists(run_dir):
        raise FileNotFoundError(path)
    values: dict[tuple[str, str], object] = {}
    for key, value in read_json(storage, f"{run_dir}/config.json").get("params", {}).items():
        values[("config", key)] = value
    for key, value in read_json(storage, f"{run_dir}/meta.json").items():
        values[("meta", key)] = value
    for epoch in epochs(storage, run_dir):
        for row in read_jsonl(storage, f"{run_dir}/{epoch}/metrics.jsonl"):
            for metric, value in row["scalars"].items():
                values[("metrics", f"{epoch}.{metric} · step {row['step']} · rank {row['rank']}")] = value
        for row in read_jsonl(storage, f"{run_dir}/{epoch}/tensors/index.jsonl"):
            key = f"{epoch}.{row['path']} · step {row['step']} · rank {row['rank']}"
            values[("tensors", key)] = f"{row['shape']} {row['dtype']}"
    for row in read_jsonl(storage, f"{run_dir}/checkpoints/index.jsonl"):
        values[("checkpoints", row["tag"])] = "present"
    return values


def _cell(value) -> Cell:
    if value is None:
        return Cell(CellType.empty, "")
    if isinstance(value, (dict, list)):
        return Cell(CellType.string, json.dumps(value, sort_keys=True))
    return Cell(CellType.number if isinstance(value, (int, float)) else CellType.string, str(value))
