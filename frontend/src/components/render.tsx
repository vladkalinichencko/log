import { Table, Cell, CellType, TableKind, Representation } from "../types/domain";
import { TableView } from "./TableView";
import { LineChartView } from "./LineChartView";
import { HeatmapView } from "./HeatmapView";
import { HistogramView } from "./HistogramView";

const RENDERERS = {
  [Representation.Grid]: TableView,
  [Representation.Line]: LineChartView,
  [Representation.Heatmap]: HeatmapView,
  [Representation.Histogram]: HistogramView,
};

const isNumber = (cell: Cell) => cell.type === CellType.Number;

export function applicable(table: Table): Representation[] {
  const reps = [Representation.Grid];
  const rows = table.cells;
  if (rows.length === 0) return reps;

  const lastColumnNumeric = rows.every((row) => row.length > 0 && isNumber(row[row.length - 1]));
  const allNumeric = rows.every((row) => row.length > 0 && row.every(isNumber));

  if (table.kind === TableKind.Column && lastColumnNumeric) {
    reps.push(Representation.Line);
    reps.push(Representation.Histogram);
  }
  if (table.kind === TableKind.Grid && allNumeric) reps.push(Representation.Heatmap);
  return reps;
}

export function chartReps(table: Table): Representation[] {
  return applicable(table).filter((r) => r !== Representation.Grid);
}

export function render(table: Table, representation: Representation) {
  const View = RENDERERS[representation];
  return <View table={table} />;
}
