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

  tables_removeRow: (tableId: string, r: number) =>
    set((state: any) => {
      const tables = new Map<string, Table>(state.tables);
      const table = tables.get(tableId);
      if (table) {
        const cells = table.cells.filter((_: Cell[], ri: number) => ri !== r);
        const row_names = table.row_names
          ? table.row_names.filter((_: string, ri: number) => ri !== r)
          : null;
        tables.set(tableId, { ...table, cells, row_names });
      }
      return { tables };
    }),

  tables_removeColumn: (tableId: string, c: number) =>
    set((state: any) => {
      const tables = new Map<string, Table>(state.tables);
      const table = tables.get(tableId);
      if (table) {
        const cells = table.cells.map((row: Cell[]) =>
          row.filter((_: Cell, ci: number) => ci !== c)
        );
        const column_names = table.column_names
          ? table.column_names.filter((_: string, ci: number) => ci !== c)
          : null;
        tables.set(tableId, { ...table, cells, column_names });
      }
      return { tables };
    }),

  tables_editName: (tableId: string, kind: "table" | "row" | "col", index: number, name: string) =>
    set((state: any) => {
      const tables = new Map<string, Table>(state.tables);
      const table = tables.get(tableId);
      if (table) {
        if (kind === "table") tables.set(tableId, { ...table, name });
        else if (kind === "col" && table.column_names) {
          const column_names = table.column_names.map((n: string, ci: number) => (ci === index ? name : n));
          tables.set(tableId, { ...table, column_names });
        } else if (kind === "row" && table.row_names) {
          const row_names = table.row_names.map((n: string, ri: number) => (ri === index ? name : n));
          tables.set(tableId, { ...table, row_names });
        }
      }
      return { tables };
    }),

  tables_undo: () =>
    set((state: any) => state),
});
