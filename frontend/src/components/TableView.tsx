import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Table, Cell, CellType } from "../types/domain";
import { Cell as CellComponent } from "./Cell";
import { EditableText } from "./EditableText";
import { Button } from "./Button";
import { Menu } from "./Menu";
import { MenuButton } from "./MenuButton";
import { TableResizeHandle } from "./TableResizeHandle";
import { parsePaste } from "./parsePaste";
import { dragFsm } from "../fsm/dragFsm";
import { useStore } from "../store/store";
import { FocusMode } from "../store/slices/focusSlice";
import { cell_matches } from "../store/slices/tablesSlice";
import { is_run_ref, path_segments } from "../store/selectors/pathSelectors";
import {
  selection_anchor,
  selection_blocks,
  selection_cells,
  selection_has_cell,
  selection_has_column,
  selection_has_row,
  table_selection_selector,
  fill_target_selector,
  range_bounds,
} from "../store/selectors/tableSelectors";
import {
  filter_clauses,
  parse_columns,
  parse_heights,
  parse_sorts,
  parse_widths,
  serialize_columns,
  serialize_heights,
  serialize_sorts,
  serialize_widths,
  row_window_selector,
  table_view_selector,
  TableSort,
} from "../store/selectors/tableViewSelectors";

const EDGE = 6;
const ESTIMATED_ROW_HEIGHT = 30;

const selectionMode = (event: React.MouseEvent): FocusMode =>
  event.metaKey || event.ctrlKey ? "add" : event.shiftKey ? "extend" : "replace";

interface TableViewProps {
  table: Table;
  editable?: boolean;
}

export function TableView({ table, editable }: TableViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tableId = table.source_path || table.name;
  const addRow = useStore((state) => state.tables_addRow);
  const addColumn = useStore((state) => state.tables_addColumn);
  const editCell = useStore((state) => state.tables_editCell);
  const editName = useStore((state) => state.tables_editName);
  const pasteBlock = useStore((state) => state.tables_pasteBlock);
  const clearCells = useStore((state) => state.tables_clearCells);
  const fill = useStore((state) => state.tables_fill);
  const replaceText = useStore((state) => state.tables_replaceText);
  const startRange = useStore((state) => state.focus_startRange);
  const extendRange = useStore((state) => state.focus_extendRange);
  const selection = useStore((state) => table_selection_selector(state, tableId));
  const picking = useStore((state) => state.picking);
  const pickColumn = useStore((state) => state.focus_pickColumn);
  const tableRef = useRef<HTMLTableElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(ESTIMATED_ROW_HEIGHT);
  const [visibleBand, setVisibleBand] = useState({ top: 0, bottom: window.innerHeight });
  const filterRef = useRef<HTMLInputElement>(null);
  const columns = table.cells[0]?.length ?? table.column_names?.length ?? 0;
  const paramsRef = useRef<{ value: URLSearchParams; requested: string | null }>({
    value: searchParams,
    requested: null,
  });
  const [selectionState, setSelectionState] = useState(dragFsm.initial);
  const [fillState, setFillState] = useState(dragFsm.initial);
  const [fillEnd, setFillEnd] = useState<{ r: number; c: number } | null>(null);
  const [findText, setFindText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [frozenOffsets, setFrozenOffsets] = useState<Record<number, number>>({});
  const filterKey = `filter.${tableId}`;
  const sortKey = `sort.${tableId}`;
  const widthKey = `width.${tableId}`;
  const heightKey = `height.${tableId}`;
  const columnsKey = `columns.${tableId}`;
  const freezeKey = `freeze.${tableId}`;
  const query = searchParams.get(filterKey) ?? "";
  const sorts = parse_sorts(searchParams.get(sortKey));
  const widths = parse_widths(searchParams.get(widthKey));
  const heights = parse_heights(searchParams.get(heightKey));
  const visibleColumns = parse_columns(searchParams.get(columnsKey), columns);
  const requestedFrozen = Number(searchParams.get(freezeKey) ?? 0);
  const frozenCount = Number.isInteger(requestedFrozen)
    ? Math.max(0, Math.min(requestedFrozen, visibleColumns.length))
    : 0;
  const view = table_view_selector(table, query, sorts);
  const runTable = path_segments(table.source_path ?? "").length === 1 &&
    table.cells.every((row) => row[0]?.type === CellType.TableRef && is_run_ref(row[0].ref));
  const span = visibleColumns.length + (runTable ? 1 : 0) + (table.row_names ? 1 : 0);
  const activeRange = selection?.ranges[selection.ranges.length - 1];
  const fillSource = editable && activeRange?.kind === "cell" ? range_bounds(activeRange) : null;
  const fillTarget = fillSource && fillEnd ? fill_target_selector(fillSource, fillEnd) : null;
  const inFillTarget = (r: number, c: number) =>
    fillTarget !== null && fillSource !== null && r <= fillTarget.bottom && c <= fillTarget.right
      && r >= fillTarget.top && c >= fillTarget.left && (r > fillSource.bottom || c > fillSource.right);
  const rowWindow = row_window_selector(
    view.rows.map((row) => heights[row.index] ?? rowHeight),
    visibleBand.top,
    visibleBand.bottom
  );

  useLayoutEffect(() => {
    const measure = () => {
      const body = bodyRef.current;
      const scroller = scrollRef.current;
      if (!body || !scroller) return;
      const bodyBox = body.getBoundingClientRect();
      const scrollBox = scroller.getBoundingClientRect();
      const top = Math.max(scrollBox.top, 0) - bodyBox.top;
      const bottom = Math.min(scrollBox.bottom, window.innerHeight) - bodyBox.top;
      setVisibleBand((band) => (band.top === top && band.bottom === bottom ? band : { top, bottom }));
      const plainRow = body.querySelector<HTMLElement>("tr[data-row]:not([style])");
      if (plainRow) setRowHeight(plainRow.getBoundingClientRect().height || ESTIMATED_ROW_HEIGHT);
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, []);

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

  const setHeight = (row: number, height: number) => {
    setParam(heightKey, serialize_heights({ ...heights, [row]: height }));
  };

  const setColumns = (next: number[]) => setParam(columnsKey, serialize_columns(next));

  const toggleColumn = (column: number) => {
    setColumns(visibleColumns.includes(column)
      ? visibleColumns.filter((visible) => visible !== column)
      : [...visibleColumns, column]);
  };

  const moveColumn = (column: number, direction: -1 | 1) => {
    const from = visibleColumns.indexOf(column);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= visibleColumns.length) return;
    const next = [...visibleColumns];
    [next[from], next[to]] = [next[to], next[from]];
    setColumns(next);
  };

  useLayoutEffect(() => {
    let left = 0;
    const next: Record<number, number> = {};
    for (const column of visibleColumns.slice(0, frozenCount)) {
      next[column] = left;
      const header = tableRef.current?.querySelector<HTMLElement>(`th[data-column="${column}"]`);
      left += header?.getBoundingClientRect().width ?? 0;
    }
    if (JSON.stringify(next) !== JSON.stringify(frozenOffsets)) setFrozenOffsets(next);
  }, [visibleColumns.join(","), frozenCount, searchParams.toString()]);

  useEffect(() => {
    if (!editable || !selection) return;
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const block = parsePaste(e.clipboardData?.getData("text/plain") ?? "");
      if (block.length === 0) return;
      e.preventDefault();
      const anchor = selection_anchor(selection);
      pasteBlock(tableId, anchor.r, anchor.c, block);
    };
    const onCopy = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      const text = selection_blocks(table, selection)
        .map((block) => block.map((row) => row.join("\t")).join("\n"))
        .join("\n\n");
      e.clipboardData?.setData("text/plain", text);
    };
    const onCut = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      onCopy(e);
      clearCells(tableId, selection_cells(table, selection));
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
    };
  }, [editable, selection, tableId, table]);

  useEffect(() => {
    if (selectionState !== "dragging") return;
    const end = () => setSelectionState((state) => dragFsm.next(state, "up"));
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, [selectionState]);

  useEffect(() => {
    if (fillState !== "dragging") return;
    const end = () => {
      if (fillSource && fillTarget) fill(tableId, fillSource, fillTarget);
      setFillEnd(null);
      setFillState((state) => dragFsm.next(state, "up"));
    };
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, [fillState, fillSource, fillTarget]);

  const beginSelection = (r: number, c: number, event: React.MouseEvent) => {
    if (!editable) return;
    event.preventDefault();
    startRange({ tableId, kind: "cell", r, c }, selectionMode(event));
    setSelectionState((state) => dragFsm.next(state, "down"));
  };

  const beginFill = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setFillState((state) => dragFsm.next(state, "down"));
  };

  const extendSelection = (r: number, c: number) => {
    if (selectionState === "dragging") extendRange({ tableId, kind: "cell", r, c });
    if (fillState === "dragging") setFillEnd({ r, c });
  };

  const selectFromEdge = (e: React.MouseEvent) => {
    if (!editable || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const onVerticalEdge =
      Math.abs(e.clientX - rect.left) <= EDGE || Math.abs(e.clientX - rect.right) <= EDGE;
    const onHorizontalEdge =
      Math.abs(e.clientY - rect.top) <= EDGE || Math.abs(e.clientY - rect.bottom) <= EDGE;
    const rows = [...tableRef.current.querySelectorAll<HTMLElement>("tbody tr[data-row]")];
    if (onVerticalEdge && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const row = rows.find((candidate) => {
        const box = candidate.getBoundingClientRect();
        return e.clientY >= box.top && e.clientY <= box.bottom;
      });
      if (row) startRange({ tableId, kind: "row", r: Number(row.dataset.row), c: -1 }, selectionMode(e));
    } else if (onHorizontalEdge && e.clientX >= rect.left && e.clientX <= rect.right) {
      const cells = [...(rows[0]?.querySelectorAll<HTMLElement>("td[data-column]") ?? [])];
      const cell = cells.find((candidate) => {
        const box = candidate.getBoundingClientRect();
        return e.clientX >= box.left && e.clientX <= box.right;
      });
      if (cell) startRange({ tableId, kind: "col", r: -1, c: Number(cell.dataset.column) }, selectionMode(e));
    }
  };

  const rowSelected = (r: number) => selection_has_row(selection, r);
  const colClass = (position: number, c: number) => {
    if (!selection_has_column(selection, c)) return undefined;
    const top = table.column_names ? position === -1 : position === 0;
    const bottom = position === view.rows.length - 1;
    return ["col-selected", top ? "col-top" : "", bottom ? "col-bottom" : ""].join(" ").trim();
  };
  const frozen = (column: number) => visibleColumns.indexOf(column) < frozenCount;
  const frozenStyle = (column: number) =>
    frozen(column) ? { left: frozenOffsets[column] ?? 0 } : undefined;
  const classNames = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(" ");

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
        <MenuButton label={`Columns ${visibleColumns.length}/${columns}`} title="Choose, reorder, and freeze columns">
          {() => (
            <Menu
              sections={[
                {
                  title: "visible",
                  items: (table.column_names ?? Array.from({ length: columns }, (_, c) => `c${c}`))
                    .map((name, column) => ({
                      label: `${visibleColumns.includes(column) ? "✓" : "○"} ${name}`,
                      onPick: () => toggleColumn(column),
                    })),
                },
                {
                  title: "move left",
                  items: visibleColumns.slice(1).map((column) => ({
                    label: table.column_names?.[column] ?? `c${column}`,
                    onPick: () => moveColumn(column, -1),
                  })),
                },
                {
                  title: "move right",
                  items: visibleColumns.slice(0, -1).map((column) => ({
                    label: table.column_names?.[column] ?? `c${column}`,
                    onPick: () => moveColumn(column, 1),
                  })),
                },
                {
                  title: "freeze",
                  items: [
                    { label: "none", onPick: () => setParam(freezeKey, "") },
                    ...visibleColumns.map((column, index) => ({
                      label: `through ${table.column_names?.[column] ?? `c${column}`}`,
                      onPick: () => setParam(freezeKey, String(index + 1)),
                    })),
                  ],
                },
              ]}
            />
          )}
        </MenuButton>
        {editable && (
          <MenuButton label="Replace" title="Find text in cells and replace every match">
            {(close) => {
              const matches = table.cells.flat().filter((cell) => cell_matches(cell, findText)).length;
              return (
                <Menu>
                  <input placeholder="find" value={findText} onChange={(e) => setFindText(e.target.value)} />
                  <input placeholder="replace with" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
                  <Button
                    label={`Replace in ${matches} cells`}
                    disabled={matches === 0}
                    onClick={() => {
                      replaceText(tableId, findText, replacement);
                      close();
                    }}
                  />
                </Menu>
              );
            }}
          </MenuButton>
        )}
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
        <div ref={scrollRef}>
          <table className="table-view" ref={tableRef}>
            <colgroup>
              {runTable && <col className="selection-column" />}
              {table.row_names && <col />}
              {visibleColumns.map((column) => (
                <col key={column} style={widths[column] ? { width: widths[column] } : undefined} />
              ))}
            </colgroup>
            {table.column_names && (
              <thead>
                <tr>
                  {runTable && <th aria-label="Select runs" />}
                  {visibleColumns.map((c) => {
                    const name = table.column_names![c];
                    const sortIndex = sorts.findIndex((sort) => sort.column === c);
                    const sort = sorts[sortIndex];
                    return (
                      <th
                        key={c}
                        data-column={c}
                        className={classNames(colClass(-1, c), frozen(c) && "frozen")}
                        style={{ ...(widths[c] ? { width: widths[c] } : {}), ...frozenStyle(c) }}
                        onClick={() => picking && pickColumn(name)}
                      >
                        <div className="column-header">
                          {editable ? (
                            <EditableText className="cell" value={name} onCommit={(n) => editName(tableId, "col", c, n)} />
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
                          <TableResizeHandle axis="column" onResize={(width) => setWidth(c, width)} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody ref={bodyRef}>
              {rowWindow.before > 0 && (
                <tr className="row-spacer" aria-hidden="true"><td colSpan={span} style={{ height: rowWindow.before }} /></tr>
              )}
              {view.rows.slice(rowWindow.from, rowWindow.to).map((row, offset) => (
                <tr
                  key={row.index}
                  data-row={row.index}
                  className={rowSelected(row.index) ? "selected" : undefined}
                  style={heights[row.index] ? { height: heights[row.index] } : undefined}
                >
                  {runTable && (
                    <td className="run-selection">
                      <Button
                        label={rowSelected(row.index) ? "✓" : "○"}
                        title={`Select run ${row.cells[0]?.value}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          startRange(
                            { tableId, kind: "row", r: row.index, c: -1 },
                            "toggle"
                          );
                        }}
                      />
                    </td>
                  )}
                  {table.row_names && (
                    <th className={colClass(rowWindow.from + offset, -2)}>
                      {editable ? (
                        <EditableText
                          className="cell"
                          value={row.rowName!}
                          onCommit={(n) => editName(tableId, "row", row.index, n)}
                        />
                      ) : (
                        <span className="cell">{row.rowName}</span>
                      )}
                    </th>
                  )}
                  {visibleColumns.map((c, visibleIndex) => {
                    const cell: Cell = row.cells[c];
                    return (
                    <td
                      key={c}
                      data-column={c}
                      className={classNames(
                        colClass(rowWindow.from + offset, c),
                        frozen(c) && "frozen",
                        inFillTarget(row.index, c) && "fill-target"
                      )}
                      style={frozenStyle(c)}
                    >
                      {fillSource && row.index === fillSource.bottom && c === fillSource.right && (
                        <span className="fill-handle" title="Drag to fill down or right" onMouseDown={beginFill} />
                      )}
                      <CellComponent
                        cell={cell}
                        editable={editable}
                        selected={selection_has_cell(selection, row.index, c)}
                        onCommit={(value) => editCell(tableId, row.index, c, value)}
                        onSelect={(event) => beginSelection(row.index, c, event)}
                        onExtend={() => extendSelection(row.index, c)}
                      />
                      {visibleIndex === 0 && (
                        <TableResizeHandle
                          axis="row"
                          onResize={(height) => setHeight(row.index, height)}
                        />
                      )}
                    </td>
                    );
                  })}
                </tr>
              ))}
              {rowWindow.after > 0 && (
                <tr className="row-spacer" aria-hidden="true"><td colSpan={span} style={{ height: rowWindow.after }} /></tr>
              )}
            </tbody>
          </table>
          {editable && <Button icon="plus" ghost title="add row" onClick={() => addRow(tableId)} />}
        </div>
        {editable && <Button icon="plus" ghost title="add column" onClick={() => addColumn(tableId)} />}
      </div>
    </div>
  );
}
