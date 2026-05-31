import { Table } from "../types/domain";

interface LineChartViewProps {
  table: Table;
}

export function LineChartView({ table }: LineChartViewProps) {
  return <div>{table.name} (line chart)</div>;
}
