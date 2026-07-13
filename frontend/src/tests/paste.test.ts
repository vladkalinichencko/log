import { describe, it, expect } from "vitest";
import { parsePaste } from "../components/parsePaste";
import { useStore } from "../store/store";
import { CellType, Representation, TableKind } from "../types/domain";

describe("parsePaste", () => {
  it("splits Excel TSV into a grid", () => {
    expect(parsePaste("1\t2\n3\t4\n")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("parses a markdown table and drops the divider row", () => {
    expect(parsePaste("| a | b |\n| --- | ---: |\n| 1 | 2 |")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("splits plain numbers on whitespace and newlines", () => {
    expect(parsePaste("1 2\n3 4")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

const cell = (value: string) => ({ type: CellType.Number, value, ref: null });

const table = () => ({
  name: "t",
  kind: TableKind.Grid,
  column_names: ["a", "b"],
  row_names: null,
  cells: [[cell("1"), cell("2")]],
  representation: Representation.Grid,
  source_path: "paste-t",
});

describe("tables_pasteBlock", () => {
  it("writes the block at the anchor and grows the table to fit", () => {
    const s = () => useStore.getState() as any;
    s().tables_loadTable("paste-t", table());
    s().tables_pasteBlock("paste-t", 0, 1, [
      ["9", "8"],
      ["7", "6"],
    ]);
    const t = s().tables.get("paste-t");
    expect(t.cells.length).toBe(2);
    expect(t.cells[0].map((c: any) => c.value)).toEqual(["1", "9", "8"]);
    expect(t.cells[1].map((c: any) => c.value)).toEqual(["", "7", "6"]);
    expect(t.column_names).toEqual(["a", "b", ""]);
    expect(t.cells[0][1].type).toBe(CellType.Number);
  });

  it("is one undoable edit", () => {
    const s = () => useStore.getState() as any;
    s().tables_loadTable("paste-t", table());
    s().tables_pasteBlock("paste-t", 0, 0, [["5"]]);
    s().tables_undo();
    expect(s().tables.get("paste-t").cells[0][0].value).toBe("1");
  });
});
