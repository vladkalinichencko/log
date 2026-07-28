import { Table } from "../../types/domain";
import { FocusRange, FocusSelection } from "../slices/focusSlice";

export function table_selector(state: any, tableId: string): Table | undefined {
  return state.tables.get(tableId);
}

export const range_bounds = (range: FocusRange) => ({
  top: Math.min(range.r, range.endR),
  bottom: Math.max(range.r, range.endR),
  left: Math.min(range.c, range.endC),
  right: Math.max(range.c, range.endC),
});

export function isFocused(state: any, tableId: string, r: number, c: number): boolean {
  if (state.focused?.tableId !== tableId) return false;
  return state.focused.ranges.some((range: FocusRange) => {
    const bounds = range_bounds(range);
    return range.kind === "cell" &&
      r >= bounds.top && r <= bounds.bottom &&
      c >= bounds.left && c <= bounds.right;
  });
}

export function isInFocusedLine(state: any, tableId: string, r: number, c: number): boolean {
  if (state.focused?.tableId !== tableId) return false;
  return state.focused.ranges.some((range: FocusRange) => {
    const bounds = range_bounds(range);
    return range.kind === "row"
      ? r >= bounds.top && r <= bounds.bottom
      : range.kind === "col" && c >= bounds.left && c <= bounds.right;
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

export function selection_anchor(selection: FocusSelection) {
  const active = selection.ranges[selection.ranges.length - 1];
  const bounds = range_bounds(active);
  return { r: Math.max(0, bounds.top), c: Math.max(0, bounds.left) };
}
