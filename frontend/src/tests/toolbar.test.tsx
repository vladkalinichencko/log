import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toolbar } from "../components/Toolbar";
import { useStore } from "../store/store";
import { Table, CellType, TableKind, Representation } from "../types/domain";

const grid: Table = {
  name: "t",
  kind: TableKind.Grid,
  column_names: ["a", "b"],
  row_names: null,
  cells: [
    [
      { type: CellType.Number, value: "1", ref: null },
      { type: CellType.Number, value: "2", ref: null },
    ],
  ],
  representation: Representation.Grid,
  source_path: "t9",
};

describe("Toolbar", () => {
  it("trash is disabled without a row/col selection and deletes after confirm", () => {
    const s = () => useStore.getState() as any;
    s().tables_loadTable("t9", grid);
    s().focus_setTarget(null);
    const { rerender } = render(<Toolbar path="t9" table={grid} />);
    expect((screen.getByTitle("delete selection") as HTMLButtonElement).disabled).toBe(true);
    s().focus_setTarget({ tableId: "t9", kind: "col", r: -1, c: 1 });
    rerender(<Toolbar path="t9" table={grid} />);
    fireEvent.click(screen.getByTitle("delete selection"));
    fireEvent.click(screen.getByText("confirm"));
    expect(s().tables.get("t9").column_names).toEqual(["a"]);
  });
});
