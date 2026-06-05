import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { PlotlyChart } from "./PlotlyChart";

interface HistogramViewProps {
  table: Table;
}

export function HistogramView({ table }: HistogramViewProps) {
  return <PlotlyChart {...chartSpec(table, "histogram")} />;
}
