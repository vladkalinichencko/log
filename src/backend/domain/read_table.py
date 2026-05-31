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
            run_name = run_dir.name
            meta_path = run_dir / "meta.json"
            if meta_path.exists():
                meta = json.loads(meta_path.read_text())
                status = meta.get("status", "unknown")
                samples = meta.get("samples_seen", 0)
            else:
                status = "unknown"
                samples = 0

            cells.append(
                [
                    Cell(
                        type=CellType.table_ref,
                        value=run_name,
                        ref=f"{project}.{run_name}",
                    )
                ]
            )

        return Table(
            name=project,
            kind=TableKind.folder,
            column_names=["run"],
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
