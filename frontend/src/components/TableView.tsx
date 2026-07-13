import { useEffect, useState } from "react";
import { Table, Cell } from "../types/domain";
import { Cell as CellComponent } from "./Cell";
import { HeaderCell } from "./HeaderCell";
import { Menu } from "./Menu";
import { menuFsm } from "../fsm/menuFsm";
import { parsePaste } from "./parsePaste";
import { useStore } from "../store/store";

interface TableViewProps {
  table: Table;
}

interface MenuTarget {
  x: number;
  y: number;
  row: number | null;
  col: number | null;
}

export function TableView({ table }: TableViewProps) {
  const tableId = table.source_path || table.name;
  const addRow = useStore((state: any) => state.tables_addRow);
  const addColumn = useStore((state: any) => state.tables_addColumn);
  const removeRow = useStore((state: any) => state.tables_removeRow);
  const removeColumn = useStore((state: any) => state.tables_removeColumn);
  const editName = useStore((state: any) => state.tables_editName);
  const pasteBlock = useStore((state: any) => state.tables_pasteBlock);
  const focused = useStore((state: any) => state.focused);
  const [menuState, setMenuState] = useState(menuFsm.initial);
  const [target, setTarget] = useState<MenuTarget | null>(null);

  const openMenu = (e: React.MouseEvent, row: number | null, col: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    setTarget({ x: e.clientX, y: e.clientY, row, col });
    setMenuState((s) => menuFsm.next(s, "open"));
  };

  const closeMenu = () => setMenuState((s) => menuFsm.next(s, "close"));

  useEffect(() => {
    if (menuState !== "open") return;
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [menuState]);

  useEffect(() => {
    if (!focused || focused.tableId !== tableId) return;
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const block = parsePaste(e.clipboardData?.getData("text/plain") ?? "");
      if (block.length === 0) return;
      e.preventDefault();
      pasteBlock(tableId, focused.r, focused.c, block);
    };
    const onCopy = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", table.cells[focused.r]?.[focused.c]?.value ?? "");
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
    };
  }, [focused, tableId, table]);

  const pick = (action: () => void) => () => {
    action();
    closeMenu();
  };

  const items =
    target === null
      ? []
      : [
          { label: "add row", onPick: pick(() => addRow(tableId)) },
          { label: "add column", onPick: pick(() => addColumn(tableId)) },
          ...(target.row !== null
            ? [{ label: "delete row", onPick: pick(() => removeRow(tableId, target.row!)) }]
            : []),
          ...(target.col !== null
            ? [{ label: "delete column", onPick: pick(() => removeColumn(tableId, target.col!)) }]
            : []),
        ];

  return (
    <div>
      <table onContextMenu={(e) => openMenu(e, null, null)}>
        <caption>
          <HeaderCell name={table.name} onRename={(n) => editName(tableId, "table", 0, n)} />
        </caption>
        {table.column_names && (
          <thead>
            <tr>
              {table.row_names && <th></th>}
              {table.column_names.map((name: string, c: number) => (
                <th key={c} onContextMenu={(e) => openMenu(e, null, c)}>
                  <HeaderCell name={name} onRename={(n) => editName(tableId, "col", c, n)} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.cells.map((row: Cell[], r: number) => (
            <tr key={r}>
              {table.row_names && (
                <th onContextMenu={(e) => openMenu(e, r, null)}>
                  <HeaderCell name={table.row_names[r]} onRename={(n) => editName(tableId, "row", r, n)} />
                </th>
              )}
              {row.map((cell: Cell, c: number) => (
                <td key={c} onContextMenu={(e) => openMenu(e, r, c)}>
                  <CellComponent cell={cell} tableId={tableId} rowIndex={r} colIndex={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {menuState === "open" && target && <Menu items={items} at={{ x: target.x, y: target.y }} />}
    </div>
  );
}
