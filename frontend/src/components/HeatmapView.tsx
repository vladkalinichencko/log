import { Table } from "../types/domain";

interface HeatmapViewProps {
  table: Table;
}

export function HeatmapView({ table }: HeatmapViewProps) {
  return <div>{table.name} (heatmap)</div>;
}
