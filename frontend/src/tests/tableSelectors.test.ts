import { describe, it, expect } from "vitest";
import {
  table_selector,
  isFocused,
  selection_blocks,
  selection_cells,
  selection_rows,
} from "../store/selectors/tableSelectors";
import { CellType, Table, TableKind, Representation } from "../types/domain";

const table: Table = {
  name: "loss",
  kind: TableKind.Scalar,
  column_names: null,
  row_names: null,
  cells: [],
  representation: Representation.Grid,
  source_path: "p.run.loss",
};

describe("tableSelectors", () => {
  it("table_selector returns the table stored under its id", () => {
    const state = { tables: new Map([["p.run.loss", table]]) };
    expect(table_selector(state, "p.run.loss")).toBe(table);
    expect(table_selector(state, "missing")).toBeUndefined();
  });

  it("isFocused includes every cell in every selected rectangle", () => {
    const state = {
      focused: {
        tableId: "p.run",
        ranges: [
          { kind: "cell", r: 1, c: 2, endR: 2, endC: 3 },
          { kind: "cell", r: 0, c: 0, endR: 0, endC: 0 },
        ],
      },
    };
    expect(isFocused(state, "p.run", 1, 2)).toBe(true);
    expect(isFocused(state, "p.run", 2, 3)).toBe(true);
    expect(isFocused(state, "p.run", 0, 0)).toBe(true);
    expect(isFocused(state, "p.run", 0, 2)).toBe(false);
    expect(isFocused({ focused: null }, "p.run", 1, 2)).toBe(false);
  });

  it("derives clipboard blocks and unique cut coordinates", () => {
    const grid: Table = {
      ...table,
      cells: [
        ["a", "b"].map((value) => ({ type: CellType.String, value, ref: null })),
        ["c", "d"].map((value) => ({ type: CellType.String, value, ref: null })),
      ],
    };
    const selection = {
      tableId: "p.run",
      ranges: [
        { kind: "cell" as const, r: 0, c: 0, endR: 1, endC: 0 },
        { kind: "cell" as const, r: 1, c: 0, endR: 1, endC: 1 },
      ],
    };
    expect(selection_blocks(grid, selection)).toEqual([[["a"], ["c"]], [["c", "d"]]]);
    expect(selection_cells(grid, selection)).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 0 },
      { r: 1, c: 1 },
    ]);
  });

  it("derives ordered unique run rows from row ranges", () => {
    const selection = {
      tableId: "p",
      ranges: [
        { kind: "row" as const, r: 2, c: -1, endR: 1, endC: -1 },
        { kind: "row" as const, r: 1, c: -1, endR: 1, endC: -1 },
      ],
    };
    const grid = { ...table, cells: [[], [], []] };
    expect(selection_rows(grid, selection)).toEqual([1, 2]);
  });
});
