import json

from ..ports.storage_port import StoragePort
from .models import Cell, CellType, Representation, Table, TableKind
from .read_table import read_jsonl


def _value(value) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True)
    return str(value)


def _cell(value) -> Cell:
    if value is None:
        return Cell(type=CellType.empty, value="", ref=None)
    kind = CellType.number if isinstance(value, (int, float)) else CellType.string
    return Cell(type=kind, value=_value(value), ref=None)


def _run_values(path: str, storage: StoragePort) -> dict[tuple[str, str], object]:
    run_dir = path.replace(".", "/")
    if not storage.exists(run_dir):
        raise FileNotFoundError(path)
    values: dict[tuple[str, str], object] = {}

    config = json.loads(storage.read(f"{run_dir}/config.json"))
    for key, value in config.get("params", {}).items():
        values[("config", key)] = value

    meta = json.loads(storage.read(f"{run_dir}/meta.json"))
    for key, value in meta.items():
        values[("meta", key)] = value

    for epoch in sorted(
        name for name in storage.list_dir(run_dir)
        if name.startswith("epoch_") and storage.is_dir(f"{run_dir}/{name}")
    ):
        epoch_dir = f"{run_dir}/{epoch}"
        for row in read_jsonl(storage, f"{epoch_dir}/metrics.jsonl"):
            for metric, value in row["scalars"].items():
                key = f"{epoch}.{metric} · step {row['step']} · rank {row['rank']}"
                values[("metrics", key)] = value
        for row in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl"):
            key = f"{epoch}.{row['path']} · step {row['step']} · rank {row['rank']}"
            values[("tensors", key)] = f"{row['shape']} {row['dtype']}"

    for row in read_jsonl(storage, f"{run_dir}/checkpoints/index.jsonl"):
        values[("checkpoints", row["tag"])] = "present"
    return values


def compare_runs(paths: list[str], storage: StoragePort) -> Table:
    if len(paths) < 2:
        raise ValueError("at least two runs are required")
    runs = {path: _run_values(path, storage) for path in paths}
    keys = sorted({key for values in runs.values() for key in values})
    cells = [
        [_cell(section), _cell(key), *[_cell(runs[path].get((section, key))) for path in paths]]
        for section, key in keys
    ]
    return Table(
        name="run comparison",
        kind=TableKind.grid,
        column_names=["section", "key", *paths],
        row_names=None,
        cells=cells,
        representation=Representation.grid,
        source_path=None,
    )
