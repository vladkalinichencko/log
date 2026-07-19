import { useEffect, useRef } from "react";
import { Table, Cell } from "../types/domain";
import { Cell as CellComponent } from "./Cell";
import { HeaderCell } from "./HeaderCell";
import { Button } from "./Button";
import { parsePaste } from "./parsePaste";
import { useStore } from "../store/store";

const EDGE = 6;

interface TableViewProps {
  table: Table;
  editable?: boolean;
}

export function TableView({ table, editable }: TableViewProps) {
  const tableId = table.source_path || table.name;
  const addRow = useStore((state: any) => state.tables_addRow);
  const addColumn = useStore((state: any) => state.tables_addColumn);
  const editName = useStore((state: any) => state.tables_editName);
  const pasteBlock = useStore((state: any) => state.tables_pasteBlock);
  const setTarget = useStore((state: any) => state.focus_setTarget);
  const focused = useStore((state: any) => state.focused);
  const tableRef = useRef<HTMLTableElement>(null);

  const selection = focused && focused.tableId === tableId ? focused : null;

  useEffect(() => {
    if (!editable || !selection || selection.kind !== "cell") return;
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const block = parsePaste(e.clipboardData?.getData("text/plain") ?? "");
      if (block.length === 0) return;
      e.preventDefault();
      pasteBlock(tableId, selection.r, selection.c, block);
    };
    const onCopy = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", table.cells[selection.r]?.[selection.c]?.value ?? "");
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
    };
  }, [editable, selection, tableId, table]);

  const selectFromEdge = (e: React.MouseEvent) => {
    if (!editable || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const onVerticalEdge =
      Math.abs(e.clientX - rect.left) <= EDGE || Math.abs(e.clientX - rect.right) <= EDGE;
    const onHorizontalEdge =
      Math.abs(e.clientY - rect.top) <= EDGE || Math.abs(e.clientY - rect.bottom) <= EDGE;
    const rows = [...tableRef.current.querySelectorAll("tbody tr")];
    if (onVerticalEdge && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const r = rows.findIndex((row) => {
        const rowRect = row.getBoundingClientRect();
        return e.clientY >= rowRect.top && e.clientY <= rowRect.bottom;
      });
      if (r >= 0) setTarget({ tableId, kind: "row", r, c: -1 });
    } else if (onHorizontalEdge && e.clientX >= rect.left && e.clientX <= rect.right) {
      const firstRow = rows[0] ? [...rows[0].children] : [];
      const domIndex = firstRow.findIndex((cell) => {
        const cellRect = cell.getBoundingClientRect();
        return e.clientX >= cellRect.left && e.clientX <= cellRect.right;
      });
      const c = table.row_names ? domIndex - 1 : domIndex;
      if (c >= 0) setTarget({ tableId, kind: "col", r: -1, c });
    }
  };

  const rowSelected = (r: number) => selection?.kind === "row" && selection.r === r;
  const colSelected = (c: number) => selection?.kind === "col" && selection.c === c;
  const colClass = (r: number, c: number) => {
    if (!colSelected(c)) return undefined;
    const top = table.column_names ? r === -1 : r === 0;
    const bottom = r === table.cells.length - 1;
    return ["col-selected", top ? "col-top" : "", bottom ? "col-bottom" : ""].join(" ").trim();
  };

  const columns = table.cells[0]?.length ?? 0;

  return (
    <div>
      <div className="table-meta">{columns} cols × {table.cells.length} rows</div>
      <div className="table-frame" onClick={selectFromEdge}>
        <div>
          <table ref={tableRef}>
            {table.column_names && (
              <thead>
                <tr>
                  {table.column_names.map((name: string, c: number) => (
                    <th key={c} className={colClass(-1, c)}>
                      {editable ? (
                        <HeaderCell name={name} onRename={(n) => editName(tableId, "col", c, n)} />
                      ) : (
                        <span className="cell">{name}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {table.cells.map((row: Cell[], r: number) => (
                <tr key={r} className={rowSelected(r) ? "selected" : undefined}>
                  {table.row_names && (
                    <th className={colClass(r, -2)}>
                      {editable ? (
                        <HeaderCell
                          name={table.row_names[r]}
                          onRename={(n) => editName(tableId, "row", r, n)}
                        />
                      ) : (
                        <span className="cell">{table.row_names[r]}</span>
                      )}
                    </th>
                  )}
                  {row.map((cell: Cell, c: number) => (
                    <td key={c} className={colClass(r, c)}>
                      <CellComponent
                        cell={cell}
                        tableId={tableId}
                        rowIndex={r}
                        colIndex={c}
                        editable={editable}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {editable && <Button icon="plus" ghost title="add row" onClick={() => addRow(tableId)} />}
        </div>
        {editable && <Button icon="plus" ghost title="add column" onClick={() => addColumn(tableId)} />}
      </div>
    </div>
  );
}
