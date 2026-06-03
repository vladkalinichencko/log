import json

from ..ports.storage_port import StoragePort
from .models import Cell, CellType, Representation, Table, TableKind


def _folder(name: str, source_path: str, entries: list[tuple[str, str]]) -> Table:
    cells = [
        [Cell(type=CellType.table_ref, value=label, ref=ref)] for label, ref in entries
    ]
    return Table(
        name=name,
        kind=TableKind.folder,
        column_names=None,
        row_names=None,
        cells=cells,
        representation=Representation.grid,
        source_path=source_path,
    )


def _keyvalue(name: str, source_path: str, pairs) -> Table:
    cells = [
        [
            Cell(type=CellType.string, value=str(k), ref=None),
            Cell(type=CellType.string, value=str(v), ref=None),
        ]
        for k, v in pairs
    ]
    return Table(
        name=name,
        kind=TableKind.column,
        column_names=["key", "value"],
        row_names=None,
        cells=cells,
        representation=Representation.grid,
        source_path=source_path,
    )


def read_jsonl(storage: StoragePort, path: str) -> list[dict]:
    if not storage.exists(path):
        return []
    return [json.loads(line) for line in storage.read(path).decode().splitlines() if line.strip()]


def _child_dirs(storage: StoragePort, path: str) -> list[str]:
    prefix = f"{path}/" if path else ""
    return sorted(
        name
        for name in storage.list_dir(path)
        if not name.startswith(".") and storage.is_dir(f"{prefix}{name}")
    )


def read_table(path: str, storage: StoragePort) -> Table:
    segments = path.split(".") if path else []

    if not segments:
        cells = [
            [Cell(type=CellType.table_ref, value=name, ref=name)]
            for name in _child_dirs(storage, "")
        ]
        return Table(
            name="Projects",
            kind=TableKind.folder,
            column_names=None,
            row_names=None,
            cells=cells,
            representation=Representation.grid,
            source_path=None,
        )

    if len(segments) == 1:
        project = segments[0]
        if not storage.exists(project):
            raise FileNotFoundError(f"Project {project} not found")
        cells = []
        for run in _child_dirs(storage, project):
            meta = json.loads(storage.read(f"{project}/{run}/meta.json"))
            cells.append(
                [
                    Cell(type=CellType.table_ref, value=run, ref=f"{project}.{run}"),
                    Cell(type=CellType.string, value=meta["status"], ref=None),
                    Cell(type=CellType.number, value=str(meta["samples_seen"]), ref=None),
                ]
            )
        return Table(
            name=project,
            kind=TableKind.folder,
            column_names=["run", "status", "samples_seen"],
            row_names=None,
            cells=cells,
            representation=Representation.grid,
            source_path=project,
        )

    project, run = segments[0], segments[1]
    run_dir = f"{project}/{run}"
    if not storage.exists(run_dir):
        raise FileNotFoundError(f"Run {project}.{run} not found")
    base = f"{project}.{run}"

    if len(segments) == 2:
        entries = [("config", f"{base}.config"), ("meta", f"{base}.meta")]
        for name in sorted(n for n in storage.list_dir(run_dir) if n.startswith("epoch_")):
            entries.append((name, f"{base}.{name}"))
        if storage.exists(f"{run_dir}/checkpoints"):
            entries.append(("checkpoints", f"{base}.checkpoints"))
        return _folder(run, base, entries)

    third = segments[2]

    if len(segments) == 3 and third == "config":
        params = json.loads(storage.read(f"{run_dir}/config.json"))["params"]
        return _keyvalue("config", f"{base}.config", params.items())

    if len(segments) == 3 and third == "meta":
        meta = json.loads(storage.read(f"{run_dir}/meta.json"))
        return _keyvalue("meta", f"{base}.meta", meta.items())

    if len(segments) == 3 and third == "checkpoints":
        tags = [[Cell(type=CellType.string, value=r["tag"], ref=None)] for r in read_jsonl(storage, f"{run_dir}/checkpoints/index.jsonl")]
        return Table(
            name="checkpoints", kind=TableKind.folder, column_names=["tag"],
            row_names=None, cells=tags, representation=Representation.grid,
            source_path=f"{base}.checkpoints",
        )

    epoch = third
    epoch_dir = f"{run_dir}/{epoch}"

    if len(segments) == 3:
        entries = []
        seen = set()
        for row in read_jsonl(storage, f"{epoch_dir}/metrics.jsonl"):
            for name in row["scalars"]:
                if name not in seen:
                    seen.add(name)
                    entries.append((name, f"{base}.{epoch}.{name}"))
        for row in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl"):
            if row["path"] not in seen:
                seen.add(row["path"])
                entries.append((row["path"], f"{base}.{epoch}.{row['path']}"))
        return _folder(epoch, f"{base}.{epoch}", entries)

    leaf = ".".join(segments[3:])

    tensors = [r for r in read_jsonl(storage, f"{epoch_dir}/tensors/index.jsonl") if r["path"] == leaf]
    if tensors:
        latest = max(tensors, key=lambda r: r["step"])
        arr = storage.read_array(f"{epoch_dir}/tensors/{latest['file']}")
        grid = arr if arr.ndim == 2 else arr.reshape(1, -1) if arr.ndim < 2 else arr.reshape(arr.shape[0], -1)
        cells = [[Cell(type=CellType.number, value=str(v), ref=None) for v in row] for row in grid]
        return Table(
            name=leaf, kind=TableKind.grid, column_names=None, row_names=None,
            cells=cells, representation=Representation.grid, source_path=path,
        )

    rows = []
    for row in read_jsonl(storage, f"{epoch_dir}/metrics.jsonl"):
        if leaf in row["scalars"]:
            rows.append([
                Cell(type=CellType.number, value=str(row["step"]), ref=None),
                Cell(type=CellType.number, value=str(row["samples_seen"]), ref=None),
                Cell(type=CellType.number, value=str(row["wall_time"]), ref=None),
                Cell(type=CellType.number, value=str(row["rank"]), ref=None),
                Cell(type=CellType.number, value=str(row["scalars"][leaf]), ref=None),
            ])
    if not rows:
        raise FileNotFoundError(f"{leaf} not found in {base}.{epoch}")
    return Table(
        name=leaf, kind=TableKind.column,
        column_names=["step", "samples_seen", "wall_time", "rank", leaf],
        row_names=None, cells=rows, representation=Representation.line, source_path=path,
    )
