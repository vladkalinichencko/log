import { Table, Cell as CellData } from "../types/domain";
import { Cell as CellComponent } from "./Cell";

interface ListViewProps {
  table: Table;
}

export function ListView({ table }: ListViewProps) {
  const tableId = table.source_path || table.name;
  return (
    <div>
      <h3>{table.name}</h3>
      <ul>
        {table.cells.map((row: CellData[], r: number) => (
          <li key={r}>
            {row.map((cell: CellData, c: number) => (
              <CellComponent key={c} cell={cell} tableId={tableId} rowIndex={r} colIndex={c} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
