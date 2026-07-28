import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Table, Cell } from "../types/domain";
import { Cell as CellComponent } from "./Cell";
import { HeaderCell } from "./HeaderCell";
import { Button } from "./Button";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { parsePaste } from "./parsePaste";
import { useStore } from "../store/store";
import {
  filter_clauses,
  parse_sorts,
  parse_widths,
  serialize_sorts,
  serialize_widths,
  table_view_selector,
  TableSort,
} from "../store/selectors/tableViewSelectors";

const EDGE = 6;

interface TableViewProps {
  table: Table;
  editable?: boolean;
}

export function TableView({ table, editable }: TableViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tableId = table.source_path || table.name;
  const addRow = useStore((state: any) => state.tables_addRow);
  const addColumn = useStore((state: any) => state.tables_addColumn);
  const editName = useStore((state: any) => state.tables_editName);
  const pasteBlock = useStore((state: any) => state.tables_pasteBlock);
  const setTarget = useStore((state: any) => state.focus_setTarget);
  const focused = useStore((state: any) => state.focused);
  const picking = useStore((state: any) => state.picking);
  const pickColumn = useStore((state: any) => state.focus_pickColumn);
  const tableRef = useRef<HTMLTableElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const paramsRef = useRef<{ value: URLSearchParams; requested: string | null }>({
    value: searchParams,
    requested: null,
  });
  const filterKey = `filter.${tableId}`;
  const sortKey = `sort.${tableId}`;
  const widthKey = `width.${tableId}`;
  const query = searchParams.get(filterKey) ?? "";
  const sorts = parse_sorts(searchParams.get(sortKey));
  const widths = parse_widths(searchParams.get(widthKey));
  const view = table_view_selector(table, query, sorts);

  const selection = focused && focused.tableId === tableId ? focused : null;

  useEffect(() => {
    const current = searchParams.toString();
    if (paramsRef.current.requested === null || paramsRef.current.requested === current) {
      paramsRef.current = { value: searchParams, requested: null };
    }
  }, [searchParams]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(paramsRef.current.value);
    value ? next.set(key, value) : next.delete(key);
    paramsRef.current = { value: next, requested: next.toString() };
    setSearchParams(next, { replace: true });
  };

  const cycleSort = (column: number, additive: boolean) => {
    const at = sorts.findIndex((sort) => sort.column === column);
    const current = sorts[at];
    let next: TableSort[];
    if (!current) {
      next = additive ? [...sorts, { column, direction: "asc" }] : [{ column, direction: "asc" }];
    } else if (current.direction === "asc") {
      const descending: TableSort = { column, direction: "desc" };
      next = additive
        ? sorts.map((sort, index) => index === at ? descending : sort)
        : [descending];
    } else {
      next = additive ? sorts.filter((_, index) => index !== at) : [];
    }
    setParam(sortKey, serialize_sorts(next));
  };

  const beginFilter = (name: string) => {
    const next = [...filter_clauses(query), `${name}=`].join(", ");
    setParam(filterKey, next);
    filterRef.current?.focus();
  };

  const removeFilter = (index: number) => {
    setParam(filterKey, view.clauses.filter((_, clause) => clause !== index).join(", "));
  };

  const setWidth = (column: number, width: number) => {
    setParam(widthKey, serialize_widths({ ...widths, [column]: width }));
  };

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
    <div className="table-wrap">
      <div className="table-filter">
        <input
          ref={filterRef}
          aria-label={`Filter rows in ${table.name}`}
          placeholder="Filter rows…"
          title="Plain text searches every cell. Use column=value, column~text, or numeric comparisons; separate conditions with commas."
          value={query}
          onChange={(event) => setParam(filterKey, event.target.value)}
        />
        <span className="subtitle">{view.rows.length}/{table.cells.length} rows</span>
      </div>
      {view.clauses.length > 0 && (
        <div className="filter-chips">
          {view.clauses.map((clause, index) => (
            <Button
              key={`${clause}-${index}`}
              label={`${clause} ×`}
              title={`Remove filter: ${clause}`}
              onClick={() => removeFilter(index)}
            />
          ))}
        </div>
      )}
      {view.error && <div className="table-filter-error">{view.error}</div>}
      {editable && <div className="table-meta">{columns} cols × {table.cells.length} rows</div>}
      <div className="table-frame" onClick={selectFromEdge}>
        <div>
          <table className="table-view" ref={tableRef}>
            <colgroup>
              {table.row_names && <col />}
              {Array.from({ length: columns }, (_, column) => (
                <col key={column} style={widths[column] ? { width: widths[column] } : undefined} />
              ))}
            </colgroup>
            {table.column_names && (
              <thead>
                <tr>
                  {table.column_names.map((name: string, c: number) => {
                    const sortIndex = sorts.findIndex((sort) => sort.column === c);
                    const sort = sorts[sortIndex];
                    return (
                      <th
                        key={c}
                        className={colClass(-1, c)}
                        style={widths[c] ? { width: widths[c] } : undefined}
                        onClick={() => picking && pickColumn(name)}
                      >
                        <div className="column-header">
                          {editable ? (
                            <HeaderCell name={name} onRename={(n) => editName(tableId, "col", c, n)} />
                          ) : (
                            <span className="cell">{name}</span>
                          )}
                          <div className="column-actions">
                            <Button
                              label={sort ? `${sort.direction === "asc" ? "↑" : "↓"}${sortIndex + 1}` : "↕"}
                              ghost
                              title={`Sort by ${name}; Shift-click adds a sort key`}
                              onClick={(event) => {
                                event.stopPropagation();
                                cycleSort(c, event.shiftKey);
                              }}
                            />
                            <Button
                              icon="filter"
                              ghost
                              title={`Filter ${name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                beginFilter(name);
                              }}
                            />
                          </div>
                          <ColumnResizeHandle onResize={(width) => setWidth(c, width)} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.index} className={rowSelected(row.index) ? "selected" : undefined}>
                  {table.row_names && (
                    <th className={colClass(row.index, -2)}>
                      {editable ? (
                        <HeaderCell
                          name={row.rowName!}
                          onRename={(n) => editName(tableId, "row", row.index, n)}
                        />
                      ) : (
                        <span className="cell">{row.rowName}</span>
                      )}
                    </th>
                  )}
                  {row.cells.map((cell: Cell, c: number) => (
                    <td key={c} className={colClass(row.index, c)}>
                      <CellComponent
                        cell={cell}
                        tableId={tableId}
                        rowIndex={row.index}
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
