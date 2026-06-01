import { Table, Cell } from "../types/domain";
import { Cell as CellComponent } from "./Cell";
import { AddControl } from "./AddControl";
import { useStore } from "../store/store";

interface TableViewProps {
  table: Table;
}

export function TableView({ table }: TableViewProps) {
  const tableId = table.source_path || table.name;
  const addRow = useStore((state: any) => state.tables_addRow);
  const addColumn = useStore((state: any) => state.tables_addColumn);
  return (
    <div>
      <div>{table.name}</div>
      {table.column_names && (
        <div>
          {table.row_names && <div></div>}
          {table.column_names.map((name: string, c: number) => (
            <div key={c}>{name}</div>
          ))}
        </div>
      )}
      {table.cells.map((row: Cell[], r: number) => (
        <div key={r}>
          {table.row_names && <div>{table.row_names[r]}</div>}
          {row.map((cell: Cell, c: number) => (
            <CellComponent key={c} cell={cell} tableId={tableId} rowIndex={r} colIndex={c} />
          ))}
        </div>
      ))}
      <AddControl label="＋ column" onClick={() => addColumn(tableId)} />
      <AddControl label="＋ row" onClick={() => addRow(tableId)} />
    </div>
  );
}
