import { Table, Cell } from "../types/domain";
import { Cell as CellComponent } from "./Cell";

interface TableViewProps {
  table: Table;
}

export function TableView({ table }: TableViewProps) {
  const tableId = table.source_path || table.name;
  return (
    <div>
      <div>{table.name}</div>
      {table.cells.map((row: Cell[], r: number) => (
        <div key={r}>
          {row.map((cell: Cell, c: number) => (
            <CellComponent
              key={c}
              cell={cell}
              tableId={tableId}
              rowIndex={r}
              colIndex={c}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
