import json
from pathlib import Path

from .models import Cell, CellType, Representation, Table, TableKind


def read_table(path: str, runs_root: Path) -> Table:
    segments = path.split(".") if path else []

    if not segments or path == "":
        projects = [
            d for d in runs_root.iterdir() if d.is_dir() and not d.name.startswith(".")
        ]
        cells = [
            [Cell(type=CellType.table_ref, value=p.name, ref=p.name)]
            for p in sorted(projects)
        ]
        return Table(
            name="Projects",
            kind=TableKind.folder,
            column_names=None,
            row_names=None,
            cells=cells,
            representation=Representation.list,
            source_path=None,
        )

    elif len(segments) == 1:
        project = segments[0]
        project_dir = runs_root / project
        if not project_dir.exists():
            raise FileNotFoundError(f"Project {project} not found")

        runs = [
            d
            for d in project_dir.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        ]

        cells = []
        for run_dir in sorted(runs):
            meta = json.loads((run_dir / "meta.json").read_text())
            cells.append(
                [
                    Cell(type=CellType.table_ref, value=run_dir.name, ref=f"{project}.{run_dir.name}"),
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
            representation=Representation.list,
            source_path=project,
        )

    else:
        return Table(
            name="stub",
            kind=TableKind.grid,
            column_names=None,
            row_names=None,
            cells=[],
            representation=Representation.grid,
            source_path=path,
        )
