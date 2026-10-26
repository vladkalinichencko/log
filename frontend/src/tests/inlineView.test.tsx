import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainView } from "../components/MainView";
import { useStore } from "../store/store";
import { CellType, Representation, Table, TableKind } from "../types/domain";

const projects: Table = {
  name: "Projects",
  kind: TableKind.Folder,
  column_names: null,
  row_names: null,
  cells: [[{ type: CellType.TableRef, value: "demo", ref: "demo" }]],
  representation: Representation.Grid,
  source_path: null,
};

const demo: Table = {
  name: "demo",
  kind: TableKind.Folder,
  column_names: ["run", "status", "samples_seen"],
  row_names: null,
  cells: [[
    { type: CellType.TableRef, value: "baseline", ref: "demo.baseline" },
    { type: CellType.String, value: "finished", ref: null },
    { type: CellType.Number, value: "128", ref: null },
  ]],
  representation: Representation.Grid,
  source_path: "demo",
};

const run: Table = {
  name: "baseline",
  kind: TableKind.Folder,
  column_names: null,
  row_names: null,
  cells: [
    [{ type: CellType.TableRef, value: "config", ref: "demo.baseline.config" }],
    [{ type: CellType.TableRef, value: "meta", ref: "demo.baseline.meta" }],
  ],
  representation: Representation.Grid,
  source_path: "demo.baseline",
};

describe("InlineView", () => {
  it("renders collection references as links instead of nested tables", async () => {
    (useStore.getState() as any).tables_setViews([
      { id: "", ...projects },
      { id: "demo", ...demo },
    ]);
    render(<MemoryRouter><MainView path="" /></MemoryRouter>);
    expect((await screen.findAllByRole("table")).length).toBe(1);
    expect(screen.getByText("All projects")).toBeTruthy();
    expect(screen.getByText("demo")).toBeTruthy();
    expect(screen.queryByTitle("expand")).toBeNull();
  });

  it("lays out a run's child tables as independent resizable tiles", async () => {
    (useStore.getState() as any).tables_setViews([
      { id: "demo.baseline", ...run },
      { id: "demo.baseline.config", ...demo, name: "config", source_path: "demo.baseline.config" },
      { id: "demo.baseline.meta", ...demo, name: "meta", source_path: "demo.baseline.meta" },
    ]);
    render(<MemoryRouter><MainView path="demo.baseline" /></MemoryRouter>);
    expect(await screen.findByText("Tables")).toBeTruthy();
    expect(document.querySelectorAll(".tile-grid > .tile")).toHaveLength(2);
    expect(screen.getAllByTitle("expand")).toHaveLength(2);

    const handle = document.querySelectorAll(".resize-handle")[0];
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 101, clientY: 101 });
    expect((useStore.getState() as any).tiles.get("demo.baseline.config").w).toBe(321);
    fireEvent.mouseMove(window, { clientX: 145, clientY: 145 });
    expect((useStore.getState() as any).tiles.get("demo.baseline.config").w).toBe(365);
    expect((handle.closest(".tile") as HTMLElement).style.transition).not.toContain("width");
    fireEvent.mouseUp(window, { clientX: 145, clientY: 145 });
    expect((handle.closest(".tile") as HTMLElement).style.transition).toContain("width var(--motion-slow)");
    expect((useStore.getState() as any).tiles.get("demo.baseline.config").w).toBe(365);

    expect(document.querySelector(".tile-grid > .tile input, .tile-grid > .tile .column-actions")).toBeNull();
    const order = () => (useStore.getState() as any).order.get("demo.baseline");
    fireEvent.keyDown(document.querySelector(".tile-grid > .tile button")!, { key: "ArrowRight", altKey: true });
    expect(order()).toBeUndefined();
    fireEvent.keyDown(document.querySelectorAll(".tile-grid > .tile")[0], { key: "ArrowRight", altKey: true });
    expect(order()).toEqual(["demo.baseline.meta", "demo.baseline.config"]);
    fireEvent.keyDown(document.querySelectorAll(".tile-grid > .tile")[1], { key: "ArrowLeft", altKey: true });
    expect(order()).toEqual(["demo.baseline.config", "demo.baseline.meta"]);
  });

  it("renders a deep leaf directly", async () => {
    (useStore.getState() as any).tables_setViews([{
      id: "demo.baseline.config",
      ...demo,
      name: "config",
      cells: [[{ type: CellType.String, value: "mlp", ref: null }]],
      source_path: "demo.baseline.config",
    }]);
    render(<MemoryRouter><MainView path="demo.baseline.config" /></MemoryRouter>);
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.getByText("Data")).toBeTruthy();
    expect(document.querySelector(".tile-grid")).toBeNull();
  });
});
