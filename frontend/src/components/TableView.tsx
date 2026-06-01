import { Table, Cell } from "../types/domain";
import { Cell as CellComponent } from "./Cell";
import { HeaderCell } from "./HeaderCell";
import { DotMenu } from "./DotMenu";
import { AddControl } from "./AddControl";
import { useStore } from "../store/store";

interface TableViewProps {
  table: Table;
}

export function TableView({ table }: TableViewProps) {
  const tableId = table.source_path || table.name;
  const addRow = useStore((state: any) => state.tables_addRow);
  const addColumn = useStore((state: any) => state.tables_addColumn);
  const removeRow = useStore((state: any) => state.tables_removeRow);
  const removeColumn = useStore((state: any) => state.tables_removeColumn);
  const editName = useStore((state: any) => state.tables_editName);
  return (
    <div>
      <HeaderCell name={table.name} onRename={(n) => editName(tableId, "table", 0, n)} />
      {table.column_names && (
        <div>
          {table.row_names && <div></div>}
          {table.column_names.map((name: string, c: number) => (
            <div key={c}>
              <HeaderCell name={name} onRename={(n) => editName(tableId, "col", c, n)} />
              <DotMenu onDelete={() => removeColumn(tableId, c)} />
            </div>
          ))}
        </div>
      )}
      {table.cells.map((row: Cell[], r: number) => (
        <div key={r}>
          {table.row_names && (
            <HeaderCell name={table.row_names[r]} onRename={(n) => editName(tableId, "row", r, n)} />
          )}
          {row.map((cell: Cell, c: number) => (
            <CellComponent key={c} cell={cell} tableId={tableId} rowIndex={r} colIndex={c} />
          ))}
          <DotMenu onDelete={() => removeRow(tableId, r)} />
        </div>
      ))}
      <AddControl label="＋ column" onClick={() => addColumn(tableId)} />
      <AddControl label="＋ row" onClick={() => addRow(tableId)} />
    </div>
  );
}
