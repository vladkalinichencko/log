import { Table, Cell as CellData } from "../types/domain";
import { Cell as CellComponent } from "./Cell";

interface ListViewProps {
  table: Table;
}

export function ListView({ table }: ListViewProps) {
  const tableId = table.source_path || table.name;
  return (
    <div>
      <div>{table.name}</div>
      {table.cells.map((row: CellData[], r: number) => (
        <div key={r}>
          {row.map((cell: CellData, c: number) => (
            <CellComponent key={c} cell={cell} tableId={tableId} rowIndex={r} colIndex={c} />
          ))}
        </div>
      ))}
    </div>
  );
}
