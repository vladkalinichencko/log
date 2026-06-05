export enum CellType {
  Empty = "empty",
  String = "string",
  Number = "number",
  Bool = "bool",
  TensorRef = "tensor_ref",
  TableRef = "table_ref",
}

export enum TableKind {
  Scalar = "scalar",
  Row = "row",
  Column = "column",
  Grid = "grid",
  Folder = "folder",
}

export enum Representation {
  Grid = "grid",
  Line = "line",
  Heatmap = "heatmap",
  Histogram = "histogram",
}

export interface Cell {
  type: CellType;
  value: string;
  ref: string | null;
}

export interface Table {
  name: string;
  kind: TableKind;
  column_names: string[] | null;
  row_names: string[] | null;
  cells: Cell[][];
  representation: Representation;
  source_path: string | null;
}
