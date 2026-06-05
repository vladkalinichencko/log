import Plot from "react-plotly.js";
import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";

interface HeatmapViewProps {
  table: Table;
}

export function HeatmapView({ table }: HeatmapViewProps) {
  const { data, layout } = chartSpec(table, "heatmap");
  return <Plot data={data} layout={layout} config={{ displayModeBar: false }} style={{ width: "100%", height: "320px" }} useResizeHandler />;
}
