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
      <table>
        <caption>
          <HeaderCell name={table.name} onRename={(n) => editName(tableId, "table", 0, n)} />
        </caption>
        {table.column_names && (
          <thead>
            <tr>
              {table.row_names && <th></th>}
              {table.column_names.map((name: string, c: number) => (
                <th key={c}>
                  <HeaderCell name={name} onRename={(n) => editName(tableId, "col", c, n)} />
                  <DotMenu onDelete={() => removeColumn(tableId, c)} />
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
        )}
        <tbody>
          {table.cells.map((row: Cell[], r: number) => (
            <tr key={r}>
              {table.row_names && (
                <th>
                  <HeaderCell name={table.row_names[r]} onRename={(n) => editName(tableId, "row", r, n)} />
                </th>
              )}
              {row.map((cell: Cell, c: number) => (
                <td key={c}>
                  <CellComponent cell={cell} tableId={tableId} rowIndex={r} colIndex={c} />
                </td>
              ))}
              <td>
                <DotMenu onDelete={() => removeRow(tableId, r)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AddControl label="＋ column" onClick={() => addColumn(tableId)} />
      <AddControl label="＋ row" onClick={() => addRow(tableId)} />
    </div>
  );
}
