import { Table } from "../types/domain";

interface ListViewProps {
  table: Table;
}

export function ListView({ table }: ListViewProps) {
  // Stub for v0
  return <div>{table.name} (list view)</div>;
}
