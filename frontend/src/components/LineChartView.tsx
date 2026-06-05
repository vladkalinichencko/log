import Plot from "react-plotly.js";
import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";

interface LineChartViewProps {
  table: Table;
}

export function LineChartView({ table }: LineChartViewProps) {
  const { data, layout } = chartSpec(table, "line");
  return <Plot data={data} layout={layout} config={{ displayModeBar: false }} style={{ width: "100%", height: "320px" }} useResizeHandler />;
}
