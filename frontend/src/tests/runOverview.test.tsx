import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainView } from "../components/MainView";
import { run_stats_selector } from "../store/selectors/runSelectors";
import { useStore } from "../store/store";
import { Cell, CellType, Representation, Table, TableKind } from "../types/domain";

const number = (value: string): Cell => ({ type: value === "" ? CellType.Empty : CellType.Number, value, ref: null });
const text = (value: string): Cell => ({ type: CellType.String, value, ref: null });
const link = (value: string, ref: string): Cell => ({ type: CellType.TableRef, value, ref });

const table = (source_path: string, kind: TableKind, column_names: string[] | null, cells: Cell[][]): Table => ({
  name: source_path.split(".").pop()!,
  kind,
  column_names,
  row_names: null,
  cells,
  representation: Representation.Grid,
  source_path,
});

const meta = table("demo.base.meta", TableKind.Column, ["key", "value"], [
  [text("status"), text("running")],
  [text("samples_seen"), text("512")],
]);

const metrics = table("demo.base.metrics", TableKind.Grid, ["step", "epoch", "loss", "acc"], [
  [number("0"), number("0"), number("2.5"), number("")],
  [number("1"), number("0"), number("1.25"), number("0.5")],
  [number("2"), number("1"), number("0.123456"), number("")],
]);

afterEach(() => vi.unstubAllGlobals());

describe("run overview", () => {
  it("derives status, samples, step and the latest value of every metric", () => {
    expect(run_stats_selector(meta, metrics)).toEqual([
      { label: "status", value: "running", trend: [] },
      { label: "samples_seen", value: "512", trend: [] },
      { label: "step", value: "2", trend: [] },
      { label: "loss", value: "0.1235", trend: [2.5, 1.25, 0.123456] },
      { label: "acc", value: "0.5", trend: [0.5] },
    ]);
  });

  it("a run page shows the status strip above its tables", async () => {
    const run = table("demo.base", TableKind.Folder, null, [
      [link("meta", "demo.base.meta")],
      [link("metrics", "demo.base.metrics")],
    ]);
    useStore.getState().tables_setViews([run, meta, metrics].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter><MainView path="demo.base" /></MemoryRouter>);
    expect(await screen.findByText("0.1235")).toBeTruthy();
    const strip = document.querySelector(".stat-strip")!;
    expect([...strip.querySelectorAll(".stat > span")].map((label) => label.textContent)).toEqual([
      "status", "samples_seen", "step", "loss", "acc",
    ]);
    expect(document.querySelector(".run-overview")!.compareDocumentPosition(screen.getByText("Tables")))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
