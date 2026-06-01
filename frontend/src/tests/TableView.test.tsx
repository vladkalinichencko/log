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
  it("renders the table name and every cell value", () => {
    renderR(<TableView table={table} />);
    expect(screen.getByText("loss")).toBeTruthy();
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
      representation: Representation.List,
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

  it("＋ row adds a row to the stored table", () => {
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
    s().tables_loadTable(grid);
    renderR(<TableView table={grid} />);
    fireEvent.click(screen.getByText("＋ row"));
    expect(s().tables.get("g2").cells.length).toBe(2);
  });

  it("DotMenu deletes a column after two confirmations", () => {
    const s = () => useStore.getState() as any;
    const grid: Table = {
      name: "g",
      kind: TableKind.Grid,
      column_names: ["a", "b"],
      row_names: null,
      cells: [[{ type: CellType.Number, value: "1", ref: null }, { type: CellType.Number, value: "2", ref: null }]],
      representation: Representation.Grid,
      source_path: "g3",
    };
    s().tables_loadTable(grid);
    renderR(<TableView table={grid} />);
    fireEvent.click(screen.getAllByText("⋯")[0]);
    fireEvent.click(screen.getByText("delete"));
    fireEvent.click(screen.getByText("confirm?"));
    expect(s().tables.get("g3").column_names).toEqual(["b"]);
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
    s().tables_loadTable(grid);
    renderR(<TableView table={grid} />);
    fireEvent.doubleClick(screen.getByText("a"));
    const input = screen.getByDisplayValue("a");
    fireEvent.change(input, { target: { value: "alpha" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(s().tables.get("g4").column_names).toEqual(["alpha"]);
  });
});
