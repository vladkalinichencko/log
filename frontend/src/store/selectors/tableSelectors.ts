import { Table } from "../../types/domain";

export function table_selector(state: any, tableId: string): Table | undefined {
  return state.tables.get(tableId);
}

export function isFocused(state: any, path: string): boolean {
  return state.focusedPath === path;
}
