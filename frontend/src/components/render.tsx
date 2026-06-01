import { Table, TableKind, Representation } from "../types/domain";
import { TableView } from "./TableView";
import { ListView } from "./ListView";
import { LineChartView } from "./LineChartView";
import { HeatmapView } from "./HeatmapView";

const RENDERERS = {
  [Representation.Grid]: TableView,
  [Representation.List]: ListView,
  [Representation.Line]: LineChartView,
  [Representation.Heatmap]: HeatmapView,
};

export function applicable(table: Table): Representation[] {
  const reps = [Representation.Grid, Representation.List];
  if (table.kind === TableKind.Column) reps.push(Representation.Line);
  if (table.kind === TableKind.Grid && table.cells.length > 0) reps.push(Representation.Heatmap);
  return reps;
}

export function render(table: Table, representation: Representation) {
  const View = RENDERERS[representation];
  return <View table={table} />;
}
