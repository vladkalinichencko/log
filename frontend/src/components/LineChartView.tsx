import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { PlotlyChart } from "./PlotlyChart";

interface LineChartViewProps {
  table: Table;
}

export function LineChartView({ table }: LineChartViewProps) {
  return <PlotlyChart {...chartSpec(table, "line")} />;
}
