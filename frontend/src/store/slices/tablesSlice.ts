import { Cell, CellType, Frame, SavedView, Table, TableFunction } from "../../types/domain";
import type { SetStore, StoreData } from "../store";

interface Edit {
  tableId: string;
  table: Table;
}

export interface TensorFrames {
  steps: number[];
  frames: Frame[];
}

export interface TablesState {
  tables: Map<string, Table>;
  views: Map<string, SavedView>;
  tensors: Map<string, TensorFrames>;
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

const applyEdit = (state: StoreData, tableId: string, change: (table: Table) => Table) => {
  const table = state.tables.get(tableId);
  if (!table) return {};
  return {
    tables: new Map(state.tables).set(tableId, change(table)),
    editHistory: [...state.editHistory, { tableId, table }],
    editFuture: [],
  };
};

const step = (from: Edit[], to: Edit[], state: StoreData) => {
  const edit = from[from.length - 1];
  if (!edit) return null;
  return {
    tables: new Map(state.tables).set(edit.tableId, edit.table),
    from: from.slice(0, -1),
    to: [...to, { tableId: edit.tableId, table: state.tables.get(edit.tableId)! }],
  };
};

export const createTablesSlice = (set: SetStore) => ({
  tables: new Map<string, Table>(),
  views: new Map<string, SavedView>(),
  tensors: new Map<string, TensorFrames>(),
  functions: [],
  editHistory: [],
  editFuture: [],

  tables_loadTable: (id: string, table: Table) =>
    set((state) => ({ tables: new Map(state.tables).set(id, table) })),

  tables_loadView: (id: string, view: SavedView) =>
    set((state) => {
      const { history, future, id: _, ...table } = view;
      const others = (edits: Edit[]) => edits.filter((edit) => edit.tableId !== id);
      const restored = (snapshots: Table[] | undefined) =>
        (snapshots ?? []).map((snapshot) => ({ tableId: id, table: snapshot }));
      return {
        tables: new Map(state.tables).set(id, table),
        editHistory: [...others(state.editHistory), ...restored(history)],
        editFuture: [...others(state.editFuture), ...restored(future)],
      };
    }),

  tables_loadTensor: (id: string, tensor: TensorFrames) =>
    set((state) => ({ tensors: new Map(state.tensors).set(id, tensor) })),

  tables_setViews: (list: SavedView[]) => set({ views: new Map(list.map((view) => [view.id, view])) }),

  tables_setFunctions: (functions: TableFunction[]) => set({ functions }),

  tables_editCell: (tableId: string, r: number, c: number, value: string) =>
    set((state) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? { ...cell, value } : cell))),
      }))
    ),

  tables_addRow: (tableId: string) =>
    set((state) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: [...table.cells, (table.cells[0] ?? []).map(() => emptyCell())],
      }))
    ),

  tables_addColumn: (tableId: string) =>
    set((state) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.map((row) => [...row, emptyCell()]),
      }))
    ),

  tables_removeRow: (tableId: string, r: number) =>
    set((state) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.filter((_, ri) => ri !== r),
        row_names: table.row_names?.filter((_, ri) => ri !== r) ?? null,
      }))
    ),

  tables_removeColumn: (tableId: string, c: number) =>
    set((state) =>
      applyEdit(state, tableId, (table) => ({
        ...table,
        cells: table.cells.map((row) => row.filter((_, ci) => ci !== c)),
        column_names: table.column_names?.filter((_, ci) => ci !== c) ?? null,
      }))
    ),

  tables_editName: (tableId: string, kind: "table" | "row" | "col", index: number, name: string) =>
    set((state) =>
      applyEdit(state, tableId, (table) => {
        const rename = (names: string[] | null) => names?.map((old, i) => (i === index ? name : old)) ?? null;
        if (kind === "table") return { ...table, name };
        if (kind === "col") return { ...table, column_names: rename(table.column_names) };
        return { ...table, row_names: rename(table.row_names) };
      })
    ),

  tables_replace: (tableId: string, table: Table) =>
    set((state) => applyEdit(state, tableId, () => ({ ...table, source_path: tableId }))),

  tables_pasteBlock: (tableId: string, r: number, c: number, block: string[][]) =>
    set((state) =>
      applyEdit(state, tableId, (table) => {
        const width = Math.max(table.cells[0]?.length ?? 0, c + Math.max(...block.map((row) => row.length)));
        const height = Math.max(table.cells.length, r + block.length);
        const cells = Array.from({ length: height }, (_, ri) =>
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
    set((state) =>
      applyEdit(state, tableId, (table) => {
        const cleared = new Set(selected.map(({ r, c }) => `${r}:${c}`));
        return {
          ...table,
          cells: table.cells.map((row, r) => row.map((cell, c) => (cleared.has(`${r}:${c}`) ? emptyCell() : cell))),
        };
      })
    ),

  tables_undo: () =>
    set((state) => {
      const moved = step(state.editHistory, state.editFuture, state);
      return moved ? { tables: moved.tables, editHistory: moved.from, editFuture: moved.to } : {};
    }),

  tables_redo: () =>
    set((state) => {
      const moved = step(state.editFuture, state.editHistory, state);
      return moved ? { tables: moved.tables, editFuture: moved.from, editHistory: moved.to } : {};
    }),
});
