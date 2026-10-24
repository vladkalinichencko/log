import { describe, it, expect } from "vitest";
import { createRef } from "react";
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
    const s = useStore.getState;
    s().tables_loadTable("t9", grid);
    s().focus_clear();
    const content = createRef<HTMLDivElement>();
    const { rerender } = render(<Toolbar path="t9" table={grid} content={content} />);
    expect((screen.getByTitle("delete selection") as HTMLButtonElement).disabled).toBe(true);
    s().focus_startRange({ tableId: "t9", kind: "col", r: -1, c: 1 }, "replace");
    rerender(<Toolbar path="t9" table={grid} content={content} />);
    fireEvent.click(screen.getByTitle("delete selection"));
    fireEvent.click(screen.getByText("confirm"));
    expect(s().tables.get("t9")?.column_names).toEqual(["a"]);
  });
});
