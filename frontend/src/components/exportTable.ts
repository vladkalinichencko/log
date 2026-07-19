import { Table, Cell } from "../types/domain";

const download = (name: string, type: string, content: string) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

const rows = (table: Table): string[][] => {
  const header = table.column_names ? [table.column_names] : [];
  return [...header, ...table.cells.map((row: Cell[]) => row.map((cell: Cell) => cell.value))];
};

export function exportCsv(table: Table) {
  const text = rows(table)
    .map((row) => row.map((value) => (value.includes(",") ? `"${value}"` : value)).join(","))
    .join("\n");
  download(`${table.name}.csv`, "text/csv", text);
}

export function exportJson(table: Table) {
  download(`${table.name}.json`, "application/json", JSON.stringify(table, null, 2));
}
