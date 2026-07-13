import { Table, Cell, CellType } from "../../types/domain";

interface Edit {
  tableId: string;
  table: Table;
}

export interface TablesState {
  tables: Map<string, Table>;
  views: Map<string, Table>;
  editHistory: Edit[];
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
  };
};

export const createTablesSlice = (set: any) => ({
  tables: new Map<string, Table>(),
  views: new Map<string, Table>(),
  editHistory: [],

  tables_loadTable: (id: string, table: Table) =>
    set((state: any) => ({
      tables: new Map<string, Table>(state.tables).set(id, table),
    })),

  tables_setViews: (list: any[]) =>
    set(() => ({
      views: new Map<string, Table>(list.map((v) => [v.id, v])),
    })),

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

  tables_undo: () =>
    set((state: any) => {
      const last = state.editHistory[state.editHistory.length - 1];
      if (!last) return {};
      return {
        tables: new Map<string, Table>(state.tables).set(last.tableId, last.table),
        editHistory: state.editHistory.slice(0, -1),
      };
    }),
});
