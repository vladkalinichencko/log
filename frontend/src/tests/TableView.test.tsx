import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TableView } from "../components/TableView";
import { useStore } from "../store/store";
import { Table, CellType, TableKind, Representation } from "../types/domain";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname + location.search}</div>;
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

  it("filters rows and stores the table-local query in the URL", () => {
    const grid: Table = {
      name: "runs",
      kind: TableKind.Folder,
      column_names: ["run", "status"],
      row_names: null,
      cells: [
        [
          { type: CellType.String, value: "baseline", ref: null },
          { type: CellType.String, value: "finished", ref: null },
        ],
        [
          { type: CellType.String, value: "high_lr", ref: null },
          { type: CellType.String, value: "running", ref: null },
        ],
      ],
      representation: Representation.Grid,
      source_path: "demo",
    };
    renderR(<TableView table={grid} />);
    fireEvent.change(screen.getByLabelText("Filter rows in runs"), {
      target: { value: "status=finished" },
    });
    expect(screen.getByText("baseline")).toBeTruthy();
    expect(screen.queryByText("high_lr")).toBeNull();
    expect(screen.getByTestId("loc").textContent).toContain("filter.demo=status%3Dfinished");
  });

  it("cycles sort direction and supports Shift multi-sort", () => {
    const grid: Table = {
      name: "runs",
      kind: TableKind.Folder,
      column_names: ["run", "samples"],
      row_names: null,
      cells: [
        [
          { type: CellType.String, value: "b", ref: null },
          { type: CellType.Number, value: "2", ref: null },
        ],
        [
          { type: CellType.String, value: "a", ref: null },
          { type: CellType.Number, value: "1", ref: null },
        ],
      ],
      representation: Representation.Grid,
      source_path: "demo",
    };
    renderR(<TableView table={grid} />);
    fireEvent.click(screen.getByTitle("Sort by run; Shift-click adds a sort key"));
    expect(screen.getAllByRole("row")[1].textContent).toContain("a");
    fireEvent.click(screen.getByTitle("Sort by samples; Shift-click adds a sort key"), {
      shiftKey: true,
    });
    expect(screen.getByTestId("loc").textContent).toContain("sort.demo=0%3Aasc%2C1%3Aasc");
  });

  it("starts a column filter from its header and resizes the column", () => {
    const grid: Table = {
      name: "runs",
      kind: TableKind.Folder,
      column_names: ["status"],
      row_names: null,
      cells: [[{ type: CellType.String, value: "finished", ref: null }]],
      representation: Representation.Grid,
      source_path: "demo",
    };
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 30,
      top: 0,
      right: 120,
      bottom: 30,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    renderR(<TableView table={grid} />);

    fireEvent.click(screen.getByTitle("Filter status"));
    expect((screen.getByLabelText("Filter rows in runs") as HTMLInputElement).value).toBe("status=");
    expect(screen.getByText("Missing value for status")).toBeTruthy();

    const handle = document.querySelector(".column-resize")!;
    fireEvent.mouseDown(handle, { clientX: 20 });
    fireEvent.mouseMove(window, { clientX: 60 });
    fireEvent.mouseUp(window);
    expect(screen.getByTestId("loc").textContent).toContain("width.demo=0%3A160");
    rect.mockRestore();
  });

  it("resizes a row and stores its height in the URL", () => {
    const grid: Table = {
      name: "runs",
      kind: TableKind.Grid,
      column_names: ["status"],
      row_names: null,
      cells: [[{ type: CellType.String, value: "finished", ref: null }]],
      representation: Representation.Grid,
      source_path: "demo",
    };
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 30,
      top: 0,
      right: 120,
      bottom: 30,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    renderR(<TableView table={grid} />);
    const handle = document.querySelector(".row-resize")!;
    fireEvent.mouseDown(handle, { clientY: 10 });
    fireEvent.mouseMove(window, { clientY: 30 });
    fireEvent.mouseUp(window);
    expect(screen.getByTestId("loc").textContent).toContain("height.demo=0%3A50");
    rect.mockRestore();
  });

  it("hides a column through the table-owned Columns menu", () => {
    const grid: Table = {
      name: "runs",
      kind: TableKind.Grid,
      column_names: ["run", "status"],
      row_names: null,
      cells: [[
        { type: CellType.String, value: "baseline", ref: null },
        { type: CellType.String, value: "finished", ref: null },
      ]],
      representation: Representation.Grid,
      source_path: "demo",
    };
    renderR(<TableView table={grid} />);
    fireEvent.click(screen.getByTitle("Choose, reorder, and freeze columns"));
    fireEvent.click(screen.getByText("✓ status"));
    expect(screen.queryByRole("columnheader", { name: "status ↕ filter" })).toBeNull();
    expect(screen.getByTestId("loc").textContent).toContain("columns.demo=0");
  });

  it("toggles run rows from the collection selection column", () => {
    const s = () => useStore.getState() as any;
    s().focus_clear();
    const runs: Table = {
      name: "demo",
      kind: TableKind.Folder,
      column_names: ["run"],
      row_names: null,
      cells: [
        [{ type: CellType.TableRef, value: "baseline", ref: "demo.baseline" }],
        [{ type: CellType.TableRef, value: "high_lr", ref: "demo.high_lr" }],
      ],
      representation: Representation.Grid,
      source_path: "demo",
    };
    renderR(<TableView table={runs} />);
    fireEvent.click(screen.getByTitle("Select run baseline"));
    fireEvent.click(screen.getByTitle("Select run high_lr"));
    expect(s().focused.ranges).toHaveLength(2);
    fireEvent.click(screen.getByTitle("Select run baseline"));
    expect(s().focused.ranges).toHaveLength(1);
  });

  it("drag-selects a rectangle and Ctrl adds another range", () => {
    const grid: Table = {
      name: "range",
      kind: TableKind.Grid,
      column_names: ["a", "b"],
      row_names: null,
      cells: [
        ["1", "2"].map((value) => ({ type: CellType.Number, value, ref: null })),
        ["3", "4"].map((value) => ({ type: CellType.Number, value, ref: null })),
      ],
      representation: Representation.Grid,
      source_path: "range",
    };
    renderR(<TableView table={grid} editable />);
    fireEvent.mouseDown(screen.getByText("1"));
    fireEvent.mouseEnter(screen.getByText("4"));
    fireEvent.mouseUp(window);
    expect(document.querySelectorAll(".cell.selected")).toHaveLength(4);

    fireEvent.mouseDown(screen.getByText("2"), { ctrlKey: true });
    fireEvent.mouseUp(window);
    expect((useStore.getState() as any).focused.ranges).toHaveLength(2);
  });

  it("replaces text in every matching cell as one undoable edit", () => {
    const s = () => useStore.getState();
    const grid: Table = {
      name: "tags",
      kind: TableKind.Grid,
      column_names: ["tag", "note"],
      row_names: null,
      cells: [
        ["adam_lr", "adam warmup"].map((value) => ({ type: CellType.String, value, ref: null })),
        ["sgd_lr", "12"].map((value) => ({ type: CellType.String, value, ref: null })),
      ],
      representation: Representation.Grid,
      source_path: "tags",
    };
    s().tables_loadTable("tags", grid);
    const { unmount } = renderR(<TableView table={grid} editable />);
    fireEvent.click(screen.getByTitle("Find text in cells and replace every match"));
    fireEvent.change(screen.getByPlaceholderText("find"), { target: { value: "adam" } });
    fireEvent.change(screen.getByPlaceholderText("replace with"), { target: { value: "adamw" } });
    fireEvent.click(screen.getByText("Replace in 2 cells"));
    unmount();
    expect(s().tables.get("tags")!.cells.flat().map((cell) => cell.value)).toEqual(["adamw_lr", "adamw warmup", "sgd_lr", "12"]);
    s().tables_undo();
    expect(s().tables.get("tags")!.cells.flat().map((cell) => cell.value)).toEqual(["adam_lr", "adam warmup", "sgd_lr", "12"]);
  });

  it("zooms the table in steps and keeps the zoom in the URL", () => {
    renderR(<TableView table={table} />);
    fireEvent.click(screen.getByTitle("Zoom in"));
    fireEvent.click(screen.getByTitle("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();
    expect(document.querySelector<HTMLElement>("table")!.style.zoom).toBe("1.2");
    expect(screen.getByTestId("loc").textContent).toContain("zoom.p.run.loss=120");
    fireEvent.click(screen.getByTitle("Zoom out"));
    fireEvent.click(screen.getByTitle("Zoom out"));
    expect(screen.getByTestId("loc").textContent).not.toContain("zoom.");
  });
});
