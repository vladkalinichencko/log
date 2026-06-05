import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { PlotlyChart } from "./PlotlyChart";

interface HeatmapViewProps {
  table: Table;
}

export function HeatmapView({ table }: HeatmapViewProps) {
  return <PlotlyChart {...chartSpec(table, "heatmap")} />;
}
