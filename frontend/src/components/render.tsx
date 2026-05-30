import { Table, Representation } from "../types/domain";
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

export function render(table: Table, representation: Representation) {
  const View = RENDERERS[representation];
  return <View table={table} />;
}
