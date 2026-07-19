import { describe, it, expect } from "vitest";
import { table_selector, isFocused } from "../store/selectors/tableSelectors";
import { Table, TableKind, Representation } from "../types/domain";

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

  it("isFocused compares against the focused cell", () => {
    const state = { focused: { tableId: "p.run", kind: "cell", r: 1, c: 2 } };
    expect(isFocused(state, "p.run", 1, 2)).toBe(true);
    expect(isFocused(state, "p.run", 0, 2)).toBe(false);
    expect(isFocused({ focused: null }, "p.run", 1, 2)).toBe(false);
  });
});
