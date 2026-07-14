import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { PlotlyChart } from "./PlotlyChart";

interface ScatterViewProps {
  table: Table;
}

export function ScatterView({ table }: ScatterViewProps) {
  return <PlotlyChart {...chartSpec(table, "scatter")} />;
}
