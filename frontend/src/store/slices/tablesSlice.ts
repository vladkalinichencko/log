import { Table, Cell, CellType } from "../../types/domain";

export interface TablesState {
  tables: Map<string, Table>;
  editHistory: Table[];
}

const emptyCell = (): Cell => ({ type: CellType.Empty, value: "", ref: null });

export const createTablesSlice = (set: any) => ({
  tables: new Map<string, Table>(),
  editHistory: [],

  tables_loadTable: (table: Table) =>
    set((state: any) => ({
      tables: new Map<string, Table>(state.tables).set(
        table.source_path || table.name,
        table
      ),
    })),

  tables_editCell: (tableId: string, r: number, c: number, value: string) =>
    set((state: any) => {
      const tables = new Map<string, Table>(state.tables);
      const table = tables.get(tableId);
      if (table) {
        const cells: Cell[][] = table.cells.map((row: Cell[], ri: number) =>
          row.map((cell: Cell, ci: number) =>
            ri === r && ci === c ? { ...cell, value } : cell
          )
        );
        tables.set(tableId, { ...table, cells });
      }
      return { tables };
    }),

  tables_addRow: (tableId: string) =>
    set((state: any) => {
      const tables = new Map<string, Table>(state.tables);
      const table = tables.get(tableId);
      if (table) {
        const newRow: Cell[] = (table.cells[0] ?? []).map(() => emptyCell());
        tables.set(tableId, { ...table, cells: [...table.cells, newRow] });
      }
      return { tables };
    }),

  tables_addColumn: (tableId: string) =>
    set((state: any) => {
      const tables = new Map<string, Table>(state.tables);
      const table = tables.get(tableId);
      if (table) {
        const cells: Cell[][] = table.cells.map((row: Cell[]) => [
          ...row,
          emptyCell(),
        ]);
        tables.set(tableId, { ...table, cells });
      }
      return { tables };
    }),

  tables_undo: () =>
    set((state: any) => state),
});
