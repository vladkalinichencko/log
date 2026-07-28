import { Table, Cell, CellType } from "../../types/domain";

interface Edit {
  tableId: string;
  table: Table;
}

export interface TableFunction {
  name: string;
  kind: "aggregation" | "transform";
  windowed: boolean;
}

export interface TablesState {
  tables: Map<string, Table>;
  views: Map<string, Table>;
  functions: TableFunction[];
  editHistory: Edit[];
  editFuture: Edit[];
}

const emptyCell = (): Cell => ({ type: CellType.Empty, value: "", ref: null });

const NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

const valueCell = (value: string): Cell => ({
  type: NUMBER.test(value) ? CellType.Number : CellType.String,
  value,
  ref: null,
});

const padNames = (names: string[] | null, length: number) =>
  names ? [...names, ...Array.from({ length: Math.max(0, length - names.length) }, () => "")] : null;

const applyEdit = (state: any, tableId: string, change: (table: Table) => Table) => {
  const table = state.tables.get(tableId);
  if (!table) return {};
  return {
    tables: new Map<string, Table>(state.tables).set(tableId, change(table)),
    editHistory: [...state.editHistory, { tableId, table }],
    editFuture: [],
  };
};

export const createTablesSlice = (set: any) => ({
  tables: new Map<string, Table>(),
  views: new Map<string, Table>(),
  functions: [],
  editHistory: [],
  editFuture: [],

  tables_loadTable: (id: string, table: Table) =>
    set((state: any) => ({
      tables: new Map<string, Table>(state.tables).set(id, table),
    })),

  tables_loadView: (id: string, view: any) =>
    set((state: any) => {
      const { history, future, ...table } = view;
      const others = (edits: Edit[]) => edits.filter((edit: Edit) => edit.tableId !== id);
      const restored = (snapshots: Table[] | undefined) =>
        (snapshots ?? []).map((snapshot: Table) => ({ tableId: id, table: snapshot }));
      return {
        tables: new Map<string, Table>(state.tables).set(id, table),
        editHistory: [...others(state.editHistory), ...restored(history)],
        editFuture: [...others(state.editFuture), ...restored(future)],
      };
    }),

  tables_setViews: (list: any[]) =>
    set(() => ({
      views: new Map<string, Table>(list.map((v) => [v.id, v])),
    })),

  tables_setFunctions: (functions: TableFunction[]) => set({ functions }),

  tables_editCell: (tableId: string, r: number, c: number, value: string) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.map((row: Cell[], ri: number) =>
          row.map((cell: Cell, ci: number) =>
            ri === r && ci === c ? { ...cell, value } : cell
          )
        ),
      }))
    ),

  tables_addRow: (tableId: string) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: [...table.cells, (table.cells[0] ?? []).map(() => emptyCell())],
      }))
    ),

  tables_addColumn: (tableId: string) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.map((row: Cell[]) => [...row, emptyCell()]),
      }))
    ),

  tables_removeRow: (tableId: string, r: number) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.filter((_: Cell[], ri: number) => ri !== r),
        row_names: table.row_names
          ? table.row_names.filter((_: string, ri: number) => ri !== r)
          : null,
      }))
    ),

  tables_removeColumn: (tableId: string, c: number) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.map((row: Cell[]) => row.filter((_: Cell, ci: number) => ci !== c)),
        column_names: table.column_names
          ? table.column_names.filter((_: string, ci: number) => ci !== c)
          : null,
      }))
    ),

  tables_editName: (tableId: string, kind: "table" | "row" | "col", index: number, name: string) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => {
        if (kind === "table") return { ...table, name };
        if (kind === "col" && table.column_names)
          return {
            ...table,
            column_names: table.column_names.map((n: string, ci: number) => (ci === index ? name : n)),
          };
        if (kind === "row" && table.row_names)
          return {
            ...table,
            row_names: table.row_names.map((n: string, ri: number) => (ri === index ? name : n)),
          };
        return table;
      })
    ),

  tables_replace: (tableId: string, table: Table) =>
    set((state: any) => applyEdit(state, tableId, () => ({ ...table, source_path: tableId }))),

  tables_pasteBlock: (tableId: string, r: number, c: number, block: string[][]) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => {
        const width = Math.max(
          table.cells[0]?.length ?? 0,
          c + Math.max(...block.map((row: string[]) => row.length))
        );
        const height = Math.max(table.cells.length, r + block.length);
        const cells: Cell[][] = Array.from({ length: height }, (_, ri) =>
          Array.from({ length: width }, (_, ci) => {
            const pasted = block[ri - r]?.[ci - c];
            if (pasted !== undefined) return valueCell(pasted);
            return table.cells[ri]?.[ci] ?? emptyCell();
          })
        );
        return {
          ...table,
          cells,
          column_names: padNames(table.column_names, width),
          row_names: padNames(table.row_names, height),
        };
      })
    ),

  tables_clearCells: (tableId: string, selected: { r: number; c: number }[]) =>
    set((state: any) =>
      applyEdit(state, tableId, (table) => {
        const cells = new Set(selected.map(({ r, c }) => `${r}:${c}`));
        return {
          ...table,
          cells: table.cells.map((row, r) =>
            row.map((cell, c) => cells.has(`${r}:${c}`) ? emptyCell() : cell)
          ),
        };
      })
    ),

  tables_undo: () =>
    set((state: any) => {
      const last = state.editHistory[state.editHistory.length - 1];
      if (!last) return {};
      return {
        tables: new Map<string, Table>(state.tables).set(last.tableId, last.table),
        editHistory: state.editHistory.slice(0, -1),
        editFuture: [...state.editFuture, { tableId: last.tableId, table: state.tables.get(last.tableId) }],
      };
    }),

  tables_redo: () =>
    set((state: any) => {
      const next = state.editFuture[state.editFuture.length - 1];
      if (!next) return {};
      return {
        tables: new Map<string, Table>(state.tables).set(next.tableId, next.table),
        editFuture: state.editFuture.slice(0, -1),
        editHistory: [...state.editHistory, { tableId: next.tableId, table: state.tables.get(next.tableId) }],
      };
    }),
});
