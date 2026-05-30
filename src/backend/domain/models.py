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
    grid = "grid"
    list = "list"
    line = "line"
    heatmap = "heatmap"


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
    row_names: list[str] | None
    cells: list[list[Cell]]
    representation: Representation
    source_path: str | None
