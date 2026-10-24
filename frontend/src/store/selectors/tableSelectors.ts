import { CellType, Table } from "../../types/domain";
import { FocusRange, FocusSelection } from "../slices/focusSlice";
import type { StoreData } from "../store";

export function table_selector(state: Pick<StoreData, "tables">, tableId: string): Table | undefined {
  return state.tables.get(tableId);
}

export function table_selection_selector(state: Pick<StoreData, "focused">, tableId: string): FocusSelection | null {
  return state.focused?.tableId === tableId ? state.focused : null;
}

const range_bounds = (range: FocusRange) => ({
  top: Math.min(range.r, range.endR),
  bottom: Math.max(range.r, range.endR),
  left: Math.min(range.c, range.endC),
  right: Math.max(range.c, range.endC),
});

const within = (value: number, from: number, to: number) => value >= from && value <= to;

export function selection_has_cell(selection: FocusSelection | null, r: number, c: number): boolean {
  return Boolean(selection?.ranges.some((range) => {
    const bounds = range_bounds(range);
    return range.kind === "cell" && within(r, bounds.top, bounds.bottom) && within(c, bounds.left, bounds.right);
  }));
}

export function selection_has_row(selection: FocusSelection | null, r: number): boolean {
  return Boolean(selection?.ranges.some((range) => {
    const bounds = range_bounds(range);
    return range.kind === "row" && within(r, bounds.top, bounds.bottom);
  }));
}

export function selection_has_column(selection: FocusSelection | null, c: number): boolean {
  return Boolean(selection?.ranges.some((range) => {
    const bounds = range_bounds(range);
    return range.kind === "col" && within(c, bounds.left, bounds.right);
  }));
}

export function selection_run_refs(table: Table, selection: FocusSelection): string[] {
  return selection_rows(table, selection).flatMap((row) => {
    const ref = table.cells[row]?.find((cell) => cell.type === CellType.TableRef)?.ref;
    return ref ? [ref] : [];
  });
}

const cells_in_range = (table: Table, range: FocusRange) => {
  const bounds = range_bounds(range);
  const top = range.kind === "col" ? 0 : bounds.top;
  const bottom = range.kind === "col" ? table.cells.length - 1 : bounds.bottom;
  const left = range.kind === "row" ? 0 : bounds.left;
  const right = range.kind === "row" ? (table.cells[0]?.length ?? 1) - 1 : bounds.right;
  return Array.from({ length: bottom - top + 1 }, (_, row) =>
    Array.from({ length: right - left + 1 }, (_, column) => ({
      r: top + row,
      c: left + column,
    }))
  );
};

export function selection_blocks(table: Table, selection: FocusSelection): string[][][] {
  return selection.ranges.map((range) =>
    cells_in_range(table, range).map((row) =>
      row.map(({ r, c }) => table.cells[r]?.[c]?.value ?? "")
    )
  );
}

export function selection_cells(table: Table, selection: FocusSelection) {
  const unique = new Map<string, { r: number; c: number }>();
  selection.ranges.flatMap((range) => cells_in_range(table, range)).flat().forEach((cell) => {
    unique.set(`${cell.r}:${cell.c}`, cell);
  });
  return [...unique.values()];
}

export function selection_rows(table: Table, selection: FocusSelection) {
  const rows = new Set<number>();
  for (const range of selection.ranges) {
    if (range.kind !== "row") continue;
    const bounds = range_bounds(range);
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      if (row >= 0 && row < table.cells.length) rows.add(row);
    }
  }
  return [...rows].sort((a, b) => a - b);
}

export function selection_anchor(selection: FocusSelection) {
  const active = selection.ranges[selection.ranges.length - 1];
  const bounds = range_bounds(active);
  return { r: Math.max(0, bounds.top), c: Math.max(0, bounds.left) };
}
