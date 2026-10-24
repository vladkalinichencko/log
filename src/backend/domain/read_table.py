import json

from ..ports.storage_port import StoragePort
from .models import Cell, CellType, Representation, Table, TableKind

DERIVED_STATE_DIRS = {"views", "workspaces"}


def read_table(path: str, storage: StoragePort) -> Table:
    segments = path.split(".") if path else []
    if not segments:
        return _projects_table(storage)
    if len(segments) == 1:
        return _project_table(segments[0], storage)

    project, run, *inside = segments
    base = f"{project}.{run}"
    run_dir = f"{project}/{run}"
    if not storage.exists(run_dir):
        raise FileNotFoundError(f"Run {base} not found")
    if not inside:
        return _run_table(run, base, run_dir, storage)
    if inside == ["config"]:
        params = read_json(storage, f"{run_dir}/config.json")["params"]
        return _keyvalue_table("config", f"{base}.config", params.items())
    if inside == ["meta"]:
        meta = read_json(storage, f"{run_dir}/meta.json")
        return _keyvalue_table("meta", f"{base}.meta", meta.items())
    if inside == ["checkpoints"]:
        return _checkpoints_table(base, run_dir, storage)
    if inside == ["metrics"]:
        return _run_metrics_table(base, run_dir, storage)

    epoch, *leaf = inside
    if not leaf:
        return _epoch_table(f"{base}.{epoch}", f"{run_dir}/{epoch}", storage)
    return _leaf_table(path, ".".join(leaf), f"{run_dir}/{epoch}", storage)


def read_json(storage: StoragePort, path: str) -> dict:
    return json.loads(storage.read(path))


def read_jsonl(storage: StoragePort, path: str) -> list[dict]:
    if not storage.exists(path):
        return []
    return [json.loads(line) for line in storage.read(path).decode().splitlines() if line.strip()]


def epochs(storage: StoragePort, run_dir: str) -> list[str]:
    return sorted(
        name for name in storage.list_dir(run_dir)
        if name.startswith("epoch_") and storage.is_dir(f"{run_dir}/{name}")
    )


def _projects_table(storage: StoragePort) -> Table:
    names = [name for name in _child_dirs(storage, "") if name not in DERIVED_STATE_DIRS]
    return _folder_table("Projects", None, [(name, name) for name in names])


def _project_table(project: str, storage: StoragePort) -> Table:
    if not storage.exists(project):
        raise FileNotFoundError(f"Project {project} not found")
    cells = []
    for run in _child_dirs(storage, project):
        meta = read_json(storage, f"{project}/{run}/meta.json")
        cells.append([
            Cell(CellType.table_ref, run, f"{project}.{run}"),
            Cell(CellType.string, meta["status"]),
            Cell(CellType.number, str(meta["samples_seen"])),
        ])
    return Table(
        name=project,
        kind=TableKind.folder,
        column_names=["run", "status", "samples_seen"],
        cells=cells,
        source_path=project,
    )


def _run_table(run: str, base: str, run_dir: str, storage: StoragePort) -> Table:
    run_epochs = epochs(storage, run_dir)
    entries = [("config", f"{base}.config"), ("meta", f"{base}.meta")]
    entries += [("metrics", f"{base}.metrics")] if run_epochs else []
    entries += [(epoch, f"{base}.{epoch}") for epoch in run_epochs]
    if storage.exists(f"{run_dir}/checkpoints"):
        entries.append(("checkpoints", f"{base}.checkpoints"))
    return _folder_table(run, base, entries)


def _checkpoints_table(base: str, run_dir: str, storage: StoragePort) -> Table:
    rows = read_jsonl(storage, f"{run_dir}/checkpoints/index.jsonl")
    return Table(
        name="checkpoints",
        kind=TableKind.folder,
        column_names=["tag"],
        cells=[[Cell(CellType.string, row["tag"])] for row in rows],
        source_path=f"{base}.checkpoints",
    )


def _run_metrics_table(base: str, run_dir: str, storage: StoragePort) -> Table:
    rows = [
        (int(epoch.removeprefix("epoch_")), row)
        for epoch in epochs(storage, run_dir)
        for row in read_jsonl(storage, f"{run_dir}/{epoch}/metrics.jsonl")
    ]
    names = list(dict.fromkeys(name for _, row in rows for name in row["scalars"]))
    return Table(
        name="metrics",
        kind=TableKind.grid,
        column_names=["step", "epoch", "wall_time", "rank", *names],
        cells=[
            [_scalar_cell(row["step"]), _scalar_cell(epoch), _scalar_cell(row["wall_time"]), _scalar_cell(row["rank"])]
            + [_scalar_cell(row["scalars"].get(name)) for name in names]
            for epoch, row in rows
        ],
        source_path=f"{base}.metrics",
        representation=Representation.line,
    )


def _scalar_cell(value) -> Cell:
    return Cell(CellType.empty, "") if value is None else Cell(CellType.number, str(value))


def _epoch_table(epoch_path: str, epoch_dir: str, storage: StoragePort) -> Table:
    names = [name for row in read_jsonl(storage, f"{epoch_dir}/metrics.jsonl") for name in row["scalars"]]
    names += [row["path"] for row in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl")]
    unique = list(dict.fromkeys(names))
    epoch = epoch_path.rsplit(".", 1)[1]
    return _folder_table(epoch, epoch_path, [(name, f"{epoch_path}.{name}") for name in unique])


def _leaf_table(path: str, leaf: str, epoch_dir: str, storage: StoragePort) -> Table:
    tensors = [row for row in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl") if row["path"] == leaf]
    if tensors:
        return _tensor_table(path, leaf, epoch_dir, max(tensors, key=lambda row: row["step"]), storage)
    return _scalar_table(path, leaf, epoch_dir, storage)


def _tensor_table(path: str, leaf: str, epoch_dir: str, latest: dict, storage: StoragePort) -> Table:
    array = storage.read_array(f"{epoch_dir}/tensors/{latest['file']}")
    grid = array.reshape(1, -1) if array.ndim < 2 else array.reshape(array.shape[0], -1)
    return Table(
        name=leaf,
        kind=TableKind.grid,
        column_names=None,
        cells=[[Cell(CellType.number, str(value)) for value in row] for row in grid],
        source_path=path,
    )


def _scalar_table(path: str, leaf: str, epoch_dir: str, storage: StoragePort) -> Table:
    rows = [
        [Cell(CellType.number, str(value)) for value in (
            row["step"], row["samples_seen"], row["wall_time"], row["rank"], row["scalars"][leaf]
        )]
        for row in read_jsonl(storage, f"{epoch_dir}/metrics.jsonl")
        if leaf in row["scalars"]
    ]
    if not rows:
        raise FileNotFoundError(f"{leaf} not found in {path}")
    return Table(
        name=leaf,
        kind=TableKind.column,
        column_names=["step", "samples_seen", "wall_time", "rank", leaf],
        cells=rows,
        source_path=path,
        representation=Representation.line,
    )


def _folder_table(name: str, source_path: str | None, entries: list[tuple[str, str]]) -> Table:
    return Table(
        name=name,
        kind=TableKind.folder,
        column_names=None,
        cells=[[Cell(CellType.table_ref, label, ref)] for label, ref in entries],
        source_path=source_path,
    )


def _keyvalue_table(name: str, source_path: str, pairs) -> Table:
    return Table(
        name=name,
        kind=TableKind.column,
        column_names=["key", "value"],
        cells=[[Cell(CellType.string, str(key)), Cell(CellType.string, str(value))] for key, value in pairs],
        source_path=source_path,
    )


def _child_dirs(storage: StoragePort, path: str) -> list[str]:
    prefix = f"{path}/" if path else ""
    return sorted(
        name
        for name in storage.list_dir(path)
        if not name.startswith(".") and storage.is_dir(f"{prefix}{name}")
    )
