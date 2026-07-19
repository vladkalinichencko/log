import { describe, it, expect } from "vitest";
import { useStore } from "../store/store";
import { CellType, Representation, TableKind } from "../types/domain";

const cell = (value: string) => ({ type: CellType.Number, value, ref: null });

const table = () => ({
  name: "t",
  kind: TableKind.Grid,
  column_names: ["a", "b"],
  row_names: null,
  cells: [
    [cell("1"), cell("2")],
    [cell("3"), cell("4")],
  ],
  representation: Representation.Grid,
  source_path: "t",
});

describe("tablesSlice undo", () => {
  it("restores a removed column", () => {
    const s = () => useStore.getState() as any;
    s().tables_loadTable("t", table());
    s().tables_removeColumn("t", 1);
    expect(s().tables.get("t").column_names).toEqual(["a"]);
    s().tables_undo();
    expect(s().tables.get("t").column_names).toEqual(["a", "b"]);
    expect(s().tables.get("t").cells[0].length).toBe(2);
  });

  it("restores an edited cell and pops one edit per undo", () => {
    const s = () => useStore.getState() as any;
    s().tables_loadTable("t", table());
    s().tables_editCell("t", 0, 0, "9");
    s().tables_addRow("t");
    expect(s().tables.get("t").cells.length).toBe(3);
    s().tables_undo();
    expect(s().tables.get("t").cells.length).toBe(2);
    expect(s().tables.get("t").cells[0][0].value).toBe("9");
    s().tables_undo();
    expect(s().tables.get("t").cells[0][0].value).toBe("1");
  });

  it("redo re-applies an undone edit and a new edit clears the future", () => {
    const s = () => useStore.getState() as any;
    s().tables_loadTable("t", table());
    s().tables_editCell("t", 0, 0, "9");
    s().tables_undo();
    expect(s().tables.get("t").cells[0][0].value).toBe("1");
    s().tables_redo();
    expect(s().tables.get("t").cells[0][0].value).toBe("9");
    s().tables_undo();
    s().tables_editCell("t", 0, 0, "5");
    expect(s().editFuture.length).toBe(0);
    s().tables_redo();
    expect(s().tables.get("t").cells[0][0].value).toBe("5");
  });

  it("does nothing when the history is empty", () => {
    const s = () => useStore.getState() as any;
    while (s().editHistory.length) s().tables_undo();
    const before = s().tables;
    s().tables_undo();
    expect(s().tables).toBe(before);
  });
});
