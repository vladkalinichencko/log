import { Table } from "../types/domain";

interface ListViewProps {
  table: Table;
}

export function ListView({ table }: ListViewProps) {
  return <div>{table.name} (list view)</div>;
}
