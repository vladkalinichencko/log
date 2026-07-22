import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("InlineView", () => {
  it("keeps the parent as a table and renders child controls inside its row", async () => {
    (useStore.getState() as any).tables_setViews([
      { id: "", ...projects },
      { id: "demo", ...demo },
    ]);
    render(<MemoryRouter><MainView path="" /></MemoryRouter>);
    expect((await screen.findAllByRole("table")).length).toBe(2);
    expect(screen.getByText("demo")).toBeTruthy();
    expect(screen.getByTitle("expand")).toBeTruthy();
    expect(screen.getByTitle("table")).toBeTruthy();
  });
});
