import { Table } from "../types/domain";

interface HeatmapViewProps {
  table: Table;
}

export function HeatmapView({ table }: HeatmapViewProps) {
  // Stub for v0
  return <div>{table.name} (heatmap)</div>;
}
