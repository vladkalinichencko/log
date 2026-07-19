import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TableView } from "../components/TableView";
import { useStore } from "../store/store";
import { Table, CellType, TableKind, Representation } from "../types/domain";

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

const renderR = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      {ui}
      <LocationProbe />
    </MemoryRouter>
  );

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
  it("renders every cell value and the dimensions line in the editor", () => {
    renderR(<TableView table={table} editable />);
    expect(screen.getByText("2 cols × 1 rows")).toBeTruthy();
    expect(screen.getByText("2.5")).toBeTruthy();
    expect(screen.getByText("1.9")).toBeTruthy();
  });

  it("clicking a table_ref cell drills into it (URL changes)", () => {
    const folder: Table = {
      name: "Projects",
      kind: TableKind.Folder,
      column_names: null,
      row_names: null,
      cells: [[{ type: CellType.TableRef, value: "proj", ref: "proj" }]],
      representation: Representation.Grid,
      source_path: null,
    };
    renderR(<TableView table={folder} />);
    fireEvent.click(screen.getByText("proj"));
    expect(screen.getByTestId("loc").textContent).toBe("/proj");
  });

  it("renders column-name headers", () => {
    const grid: Table = {
      name: "g",
      kind: TableKind.Grid,
      column_names: ["alpha", "beta"],
      row_names: null,
      cells: [[{ type: CellType.Number, value: "1", ref: null }, { type: CellType.Number, value: "2", ref: null }]],
      representation: Representation.Grid,
      source_path: "g1",
    };
    renderR(<TableView table={grid} />);
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("beta")).toBeTruthy();
  });

  it("the ＋ button adds a row", () => {
    const s = () => useStore.getState() as any;
    const grid: Table = {
      name: "g",
      kind: TableKind.Grid,
      column_names: ["a"],
      row_names: null,
      cells: [[{ type: CellType.Number, value: "1", ref: null }]],
      representation: Representation.Grid,
      source_path: "g2",
    };
    s().tables_loadTable(grid.source_path, grid);
    renderR(<TableView table={grid} editable />);
    fireEvent.click(screen.getByTitle("add row"));
    expect(s().tables.get("g2").cells.length).toBe(2);
  });

  it("read-only view offers no edit controls, editor does", () => {
    const grid: Table = {
      name: "g",
      kind: TableKind.Grid,
      column_names: ["a", "b"],
      row_names: null,
      cells: [[{ type: CellType.Number, value: "1", ref: null }, { type: CellType.Number, value: "2", ref: null }]],
      representation: Representation.Grid,
      source_path: "g3",
    };
    const readOnly = renderR(<TableView table={grid} />);
    expect(readOnly.queryByTitle("add row")).toBeNull();
    readOnly.unmount();
    const editor = renderR(<TableView table={grid} editable />);
    expect(editor.getByTitle("add row")).toBeTruthy();
  });

  it("double-click + Enter renames a column header", () => {
    const s = () => useStore.getState() as any;
    const grid: Table = {
      name: "gg",
      kind: TableKind.Grid,
      column_names: ["a"],
      row_names: null,
      cells: [[{ type: CellType.Number, value: "1", ref: null }]],
      representation: Representation.Grid,
      source_path: "g4",
    };
    s().tables_loadTable(grid.source_path, grid);
    renderR(<TableView table={grid} editable />);
    fireEvent.doubleClick(screen.getByText("a"));
    const input = screen.getByDisplayValue("a");
    fireEvent.change(input, { target: { value: "alpha" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(s().tables.get("g4").column_names).toEqual(["alpha"]);
  });
});
