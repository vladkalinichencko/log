import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableView } from "../components/TableView";
import { Table, CellType, TableKind, Representation } from "../types/domain";

const table: Table = {
  name: "loss",
  kind: TableKind.Grid,
  column_names: null,
  row_names: null,
  cells: [
    [
      { type: CellType.Number, value: "2.5", ref: null },
      { type: CellType.Number, value: "1.9", ref: null },
    ],
  ],
  representation: Representation.Grid,
  source_path: "p.run.loss",
};

describe("TableView", () => {
  it("renders the table name and every cell value", () => {
    render(<TableView table={table} />);
    expect(screen.getByText("loss")).toBeTruthy();
    expect(screen.getByText("2.5")).toBeTruthy();
    expect(screen.getByText("1.9")).toBeTruthy();
  });
});
