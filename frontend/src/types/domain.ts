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
  Inline = "inline",
  Grid = "grid",
  Line = "line",
  Heatmap = "heatmap",
  Histogram = "histogram",
  Scatter = "scatter",
  Trajectory = "trajectory",
  Flame = "flame",
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

export interface TableFunction {
  name: string;
  kind: "aggregation" | "transform";
  windowed: boolean;
}

export interface SavedView extends Table {
  id: string;
  history?: Table[];
  future?: Table[];
}

export type TileMode = "table" | "visualization";

export interface WorkspaceTile {
  id: string;
  table_path: string;
  mode: TileMode;
  representation?: Representation;
  w?: number;
  h?: number;
}

export interface Workspace {
  id: string;
  tiles: WorkspaceTile[];
}

export interface ProjectSettings {
  hero: string | null;
  alerts: Record<string, boolean>;
}

export interface Frame {
  shape: number[];
  data: number[];
}

export type LiveEvent =
  | { type: "run_added" | "run_updated" | "run_removed"; run: string }
  | { type: "alert"; run: string; step: number | null; rule: string; path: string; message: string; text: string };
