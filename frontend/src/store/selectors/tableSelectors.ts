import { Table } from "../../types/domain";

export function table_selector(state: any, tableId: string): Table | undefined {
  return state.tables.get(tableId);
}

export function isFocused(state: any, tableId: string, r: number, c: number): boolean {
  return (
    state.focused !== null &&
    state.focused.tableId === tableId &&
    state.focused.kind === "cell" &&
    state.focused.r === r &&
    state.focused.c === c
  );
}

export function isInFocusedLine(state: any, tableId: string, r: number, c: number): boolean {
  if (state.focused === null || state.focused.tableId !== tableId) return false;
  if (state.focused.kind === "row") return state.focused.r === r;
  if (state.focused.kind === "col") return state.focused.c === c;
  return false;
}
