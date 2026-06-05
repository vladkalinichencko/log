import Plot from "react-plotly.js";
import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";

interface HistogramViewProps {
  table: Table;
}

export function HistogramView({ table }: HistogramViewProps) {
  const { data, layout } = chartSpec(table, "histogram");
  return <Plot data={data} layout={layout} config={{ displayModeBar: false }} style={{ width: "100%", height: "320px" }} useResizeHandler />;
}
