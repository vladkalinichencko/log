from dataclasses import dataclass
from enum import Enum
from typing import Any


class CellType(str, Enum):
    empty = "empty"
    string = "string"
    number = "number"
    bool = "bool"
    tensor_ref = "tensor_ref"
    table_ref = "table_ref"


class TableKind(str, Enum):
    scalar = "scalar"
    row = "row"
    column = "column"
    grid = "grid"
    folder = "folder"


class Representation(str, Enum):
    inline = "inline"
    grid = "grid"
    line = "line"
    heatmap = "heatmap"
    histogram = "histogram"
    scatter = "scatter"
    trajectory = "trajectory"


@dataclass
class Cell:
    type: CellType
    value: str
    ref: str | None = None


@dataclass
class Table:
    name: str
    kind: TableKind
    column_names: list[str] | None
    cells: list[list[Cell]]
    source_path: str | None
    row_names: list[str] | None = None
    representation: Representation = Representation.grid


@dataclass
class RunSummary:
    project: str
    name: str
    status: str
    samples_seen: int
    start_wall_time: float | None
    tags: list[str]
    config: dict[str, Any]
