import { Table, Cell, CellType, TableKind, Representation } from "../types/domain";
import { TableView } from "./TableView";
import { LineChartView } from "./LineChartView";
import { HeatmapView } from "./HeatmapView";
import { HistogramView } from "./HistogramView";
import { ScatterView } from "./ScatterView";
import { TrajectoryView } from "./TrajectoryView";

const RENDERERS = {
  [Representation.Grid]: TableView,
  [Representation.Line]: LineChartView,
  [Representation.Heatmap]: HeatmapView,
  [Representation.Histogram]: HistogramView,
  [Representation.Scatter]: ScatterView,
  [Representation.Trajectory]: TrajectoryView,
};

const isNumber = (cell: Cell) => cell.type === CellType.Number;

export const TRAJECTORY_COLUMNS = ["step", "point", "x", "y"];

export function applicable(table: Table): Representation[] {
  const reps = [Representation.Grid];
  const rows = table.cells;
  if (rows.length === 0) return reps;

  const lastColumnNumeric = rows.every((row) => row.length > 0 && isNumber(row[row.length - 1]));
  const allNumeric = rows.every((row) => row.length > 0 && row.every(isNumber));
  const isTrajectory =
    allNumeric &&
    table.column_names !== null &&
    table.column_names.join() === TRAJECTORY_COLUMNS.join();

  if (isTrajectory) {
    reps.push(Representation.Trajectory);
    return reps;
  }
  if (table.kind === TableKind.Column && lastColumnNumeric) {
    reps.push(Representation.Line);
    reps.push(Representation.Histogram);
  }
  if (table.kind === TableKind.Grid && allNumeric) {
    if (table.column_names && rows[0].length >= 2) reps.push(Representation.Line);
    if (rows[0].length === 2) reps.push(Representation.Scatter);
    reps.push(Representation.Heatmap);
  }
  return reps;
}

export function chartReps(table: Table): Representation[] {
  return applicable(table).filter((r) => r !== Representation.Grid);
}

export function render(table: Table, representation: Representation, editable?: boolean) {
  if (representation === Representation.Grid) {
    return <TableView table={table} editable={editable} />;
  }
  const View = RENDERERS[representation];
  return <View table={table} />;
}
