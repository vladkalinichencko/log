import { Table } from "../types/domain";

interface LineChartViewProps {
  table: Table;
}

export function LineChartView({ table }: LineChartViewProps) {
  // Stub for v0
  return <div>{table.name} (line chart)</div>;
}
