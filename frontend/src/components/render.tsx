import { ComponentType } from "react";
import { Table, Cell, CellType, TableKind, Representation } from "../types/domain";
import { TableView } from "./TableView";
import { ChartView } from "./ChartView";
import { InlineView } from "./InlineView";

interface ViewProps {
  table: Table;
  representation: Representation;
  editable?: boolean;
}

const RENDERERS: Record<Representation, ComponentType<ViewProps>> = {
  [Representation.Grid]: TableView,
  [Representation.Line]: ChartView,
  [Representation.Heatmap]: ChartView,
  [Representation.Histogram]: ChartView,
  [Representation.Scatter]: ChartView,
  [Representation.Trajectory]: ChartView,
  [Representation.Inline]: InlineView,
};

const isNumber = (cell: Cell) => cell.type === CellType.Number;

export const TRAJECTORY_COLUMNS = ["step", "point", "x", "y"];

export function applicable(table: Table): Representation[] {
  const reps = [Representation.Grid];
  const rows = table.cells;
  if (rows.length === 0) return reps;

  const lastColumnNumeric = rows.every((row) => row.length > 0 && isNumber(row[row.length - 1]));
  const allNumeric = rows.every((row) => row.length > 0 && row.every((cell) => isNumber(cell) || cell.type === CellType.Empty));
  const isTrajectory =
    allNumeric &&
    table.column_names !== null &&
    table.column_names.join() === TRAJECTORY_COLUMNS.join();

  if (isTrajectory) {
    reps.push(Representation.Trajectory);
    return reps;
  }
  if (lastColumnNumeric && table.kind !== TableKind.Grid) reps.push(Representation.Histogram);
  if (table.kind === TableKind.Column && lastColumnNumeric) {
    reps.push(Representation.Line);
  }
  if (table.kind === TableKind.Grid && allNumeric) {
    if (table.column_names && rows[0].length >= 2) reps.push(Representation.Line);
    if (rows[0].length === 2) reps.push(Representation.Scatter);
    reps.push(Representation.Heatmap);
  }
  return reps;
}

export function chartReps(table: Table): Representation[] {
  return applicable(table).filter((r) => r !== Representation.Grid && r !== Representation.Inline);
}

export function render(table: Table, representation: Representation, editable?: boolean) {
  const View = RENDERERS[representation];
  return <View table={table} representation={representation} editable={editable} />;
}
