import { Table } from "../../types/domain";

export function table_selector(state: any, tableId: string): Table | undefined {
  return state.tables.get(tableId);
}

export function isFocused(state: any, tableId: string, r: number, c: number): boolean {
  return (
    state.focused !== null &&
    state.focused.tableId === tableId &&
    state.focused.r === r &&
    state.focused.c === c
  );
}
