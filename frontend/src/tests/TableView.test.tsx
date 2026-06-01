import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableView } from "../components/TableView";
import { useStore } from "../store/store";
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

  it("clicking a table_ref cell drills into it", () => {
    const folder: Table = {
      name: "Projects",
      kind: TableKind.Folder,
      column_names: null,
      row_names: null,
      cells: [[{ type: CellType.TableRef, value: "proj", ref: "proj" }]],
      representation: Representation.List,
      source_path: null,
    };
    render(<TableView table={folder} />);
    fireEvent.click(screen.getByText("proj"));
    expect((useStore.getState() as any).currentPath).toBe("proj");
  });
});
