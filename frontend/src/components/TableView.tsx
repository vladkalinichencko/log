import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { cell_matches, TextQuery } from "../store/slices/tablesSlice";
import { is_run_ref, path_segments } from "../store/selectors/pathSelectors";
import {
  selection_anchor,
  selection_blocks,
  selection_cells,
  selection_is_range,
  cell_key,
  selection_has_cell,
  selection_has_column,
  selection_has_row,
  table_selection_selector,
  fill_target_selector,
  in_bounds,
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
  cell_step_selector,
  ARROW_STEPS,
  table_view_selector,
  TableSort,
} from "../store/selectors/tableViewSelectors";

const EDGE = 6;
const ESTIMATED_ROW_HEIGHT = 30;
const ZOOM_STEP = 10;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

const selectionMode = (event: React.MouseEvent): FocusMode =>
  event.metaKey || event.ctrlKey ? "add" : event.shiftKey ? "extend" : "replace";

export type TableUse = "browse" | "preview" | "edit";

interface TableViewProps {
  table: Table;
  use?: TableUse;
}

export function TableView({ table, use = "browse" }: TableViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const editable = use === "edit";
  const preview = use === "preview";
  const viewParam = (key: string) => (preview ? null : searchParams.get(key));
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
  const [filterFocused, setFilterFocused] = useState(false);
  const [textQuery, setTextQuery] = useState<TextQuery>({ find: "", replacement: "", matchCase: false });
  const [replaceOpen, setReplaceOpen] = useState(false);
  const trackReplacePanel = useCallback((input: HTMLInputElement | null) => setReplaceOpen(input !== null), []);
  const [frozenOffsets, setFrozenOffsets] = useState<Record<number, number>>({});
  const filterKey = `filter.${tableId}`;
  const sortKey = `sort.${tableId}`;
  const widthKey = `width.${tableId}`;
  const heightKey = `height.${tableId}`;
  const columnsKey = `columns.${tableId}`;
  const freezeKey = `freeze.${tableId}`;
  const zoomKey = `zoom.${tableId}`;
  const query = viewParam(filterKey) ?? "";
  const sorts = parse_sorts(viewParam(sortKey));
  const widths = parse_widths(viewParam(widthKey));
  const heights = parse_heights(viewParam(heightKey));
  const visibleColumns = parse_columns(viewParam(columnsKey), columns);
  const requestedFrozen = Number(viewParam(freezeKey) ?? 0);
  const frozenCount = Number.isInteger(requestedFrozen)
    ? Math.max(0, Math.min(requestedFrozen, visibleColumns.length))
    : 0;
  const requestedZoom = Number(viewParam(zoomKey) ?? 100);
  const zoom = Number.isFinite(requestedZoom) ? Math.max(ZOOM_MIN, Math.min(requestedZoom, ZOOM_MAX)) : 100;
  const view = table_view_selector(table, query, sorts);
  const filterCount = view.error ? "invalid filter" : `${view.rows.length} of ${table.cells.length} rows`;
  const runTable = path_segments(table.source_path ?? "").length === 1 &&
    table.cells.every((row) => row[0]?.type === CellType.TableRef && is_run_ref(row[0].ref));
  const span = visibleColumns.length + (runTable ? 1 : 0) + (table.row_names ? 1 : 0);
  const activeRange = selection?.ranges[selection.ranges.length - 1];
  const fillSource = editable && activeRange?.kind === "cell" ? range_bounds(activeRange) : null;
  const fillTarget = fillSource && fillEnd ? fill_target_selector(fillSource, fillEnd) : null;
  const inFillTarget = (r: number, c: number) =>
    fillTarget !== null && fillSource !== null && in_bounds(fillTarget, r, c) && !in_bounds(fillSource, r, c);
  const inSelection = selection_is_range(selection);
  const matchedCells = replaceOpen
    ? (inSelection ? selection_cells(table, selection!) : table.cells.flatMap((row, r) => row.map((_, c) => ({ r, c }))))
      .filter(({ r, c }) => table.cells[r]?.[c] && cell_matches(table.cells[r][c], textQuery))
    : [];
  const matchedKeys = new Set(matchedCells.map(cell_key));
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
      const scale = body.currentCSSZoom ?? 1;
      const top = (Math.max(scrollBox.top, 0) - bodyBox.top) / scale;
      const bottom = (Math.min(scrollBox.bottom, window.innerHeight) - bodyBox.top) / scale;
      setVisibleBand((band) => (band.top === top && band.bottom === bottom ? band : { top, bottom }));
      const plainRow = body.querySelector<HTMLElement>("tr[data-row]:not([style])");
      if (plainRow) setRowHeight(plainRow.getBoundingClientRect().height / scale || ESTIMATED_ROW_HEIGHT);
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [zoom]);

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

  const setZoom = (next: number) => setParam(zoomKey, next === 100 ? "" : String(next));

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
      left += header ? header.getBoundingClientRect().width / (header.currentCSSZoom ?? 1) : 0;
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
    const onKeyDown = (e: KeyboardEvent) => {
      const step = ARROW_STEPS[e.key];
      const command = e.metaKey || e.ctrlKey;
      const active = selection.ranges[selection.ranges.length - 1];
      if (e.defaultPrevented || e.target instanceof HTMLInputElement || active?.kind !== "cell") return;
      if (step) {
        const from = e.shiftKey ? { r: active.endR, c: active.endC } : { r: active.r, c: active.c };
        const to = cell_step_selector(view.rows.map((row) => row.index), visibleColumns, from, step);
        if (!to) return;
        e.preventDefault();
        if (e.shiftKey) extendRange({ tableId, kind: "cell", ...to });
        else startRange({ tableId, kind: "cell", ...to }, "replace");
      } else if (e.key === " " && (e.shiftKey || command)) {
        e.preventDefault();
        startRange(
          e.shiftKey ? { tableId, kind: "row", r: active.endR, c: -1 } : { tableId, kind: "col", r: -1, c: active.endC },
          "replace"
        );
      } else if (command && e.key.toLowerCase() === "d") {
        const bounds = range_bounds(active);
        const top = bounds.top === bounds.bottom ? bounds.top - 1 : bounds.top;
        if (top < 0) return;
        e.preventDefault();
        fill(tableId, { ...bounds, top, bottom: top }, { ...bounds, top });
      }
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editable, selection, tableId, table, searchParams]);

  useEffect(() => {
    if (activeRange?.kind !== "cell") return;
    const cell = tableRef.current?.querySelector<HTMLElement>(
      `tr[data-row="${activeRange.endR}"] td[data-column="${activeRange.endC}"] .cell`
    );
    cell?.focus({ preventScroll: true });
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeRange?.kind, activeRange?.endR, activeRange?.endC]);

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
      {!preview && (
      <div className="table-filter">
        <label className="filter-field">
          <input
            ref={filterRef}
            aria-label={`Filter rows in ${table.name}`}
            placeholder="Filter rows…"
            title="Plain text searches every cell. Use column=value, column~text, or numeric comparisons; separate conditions with commas."
            value={query}
            style={query ? { paddingRight: `${filterCount.length + 2}ch` } : undefined}
            onChange={(event) => setParam(filterKey, event.target.value)}
            onFocus={() => setFilterFocused(true)}
            onBlur={() => setFilterFocused(false)}
          />
          {query && <span className={view.error ? "filter-count invalid" : "filter-count subtitle"}>{filterCount}</span>}
          {filterFocused && (view.error || view.clauses.length > 0) && (
            <div className="filter-overlay" onMouseDown={(event) => event.preventDefault()}>
              {view.error && <span className="invalid">{view.error}</span>}
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
        </label>
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
        <div className="toggle">
          <Button label="−" title="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom(zoom - ZOOM_STEP)} />
          <Button label={`${zoom}%`} title="Reset zoom to 100%" onClick={() => setZoom(100)} />
          <Button label="+" title="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom(zoom + ZOOM_STEP)} />
        </div>
        {editable && (
          <MenuButton
            label={inSelection ? "Replace in selection" : "Replace"}
            title={inSelection ? "Find text in the selected cells and replace every match" : "Find text in cells and replace every match"}
          >
            {(close) => (
              <Menu>
                <input
                  ref={trackReplacePanel}
                  placeholder="find"
                  value={textQuery.find}
                  onChange={(e) => setTextQuery({ ...textQuery, find: e.target.value })}
                />
                <input
                  placeholder="replace with"
                  value={textQuery.replacement}
                  onChange={(e) => setTextQuery({ ...textQuery, replacement: e.target.value })}
                />
                <label className="group">
                  <input
                    type="checkbox"
                    checked={textQuery.matchCase}
                    onChange={(e) => setTextQuery({ ...textQuery, matchCase: e.target.checked })}
                  />
                  Match case
                </label>
                <Button
                  label={`Replace in ${matchedCells.length} ${inSelection ? "selected " : ""}cells`}
                  disabled={matchedCells.length === 0}
                  onClick={() => {
                    replaceText(tableId, textQuery, matchedCells);
                    close();
                  }}
                />
              </Menu>
            )}
          </MenuButton>
        )}
      </div>
      )}
      {editable && <div className="table-meta">{columns} cols × {table.cells.length} rows</div>}
      <div className="table-frame" onClick={selectFromEdge}>
        <div ref={scrollRef}>
          <table className="table-view" ref={tableRef} style={{ zoom: zoom / 100 }}>
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
                          {!preview && (
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
                          )}
                          {!preview && <TableResizeHandle axis="column" onResize={(width) => setWidth(c, width)} />}
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
                        inFillTarget(row.index, c) && "fill-target",
                        matchedKeys.has(cell_key({ r: row.index, c })) && "match",
                        cell.type === CellType.Number && "number"
                      )}
                      style={frozenStyle(c)}
                    >
                      {fillSource && row.index === fillSource.bottom && c === fillSource.right && (
                        <span className="fill-handle" title="Drag to fill in any direction" onMouseDown={beginFill} />
                      )}
                      <CellComponent
                        cell={cell}
                        editable={editable}
                        selected={selection_has_cell(selection, row.index, c)}
                        onCommit={(value) => editCell(tableId, row.index, c, value)}
                        onSelect={(event) => beginSelection(row.index, c, event)}
                        onExtend={() => extendSelection(row.index, c)}
                      />
                      {visibleIndex === 0 && !preview && (
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
