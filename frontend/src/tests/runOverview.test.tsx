import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainView } from "../components/MainView";
import { execution_strip_selector, run_stats_selector } from "../store/selectors/runSelectors";
import { chartSpec } from "../components/chartSpec";
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

const metrics = table("demo.base.metrics", TableKind.Grid, ["step", "epoch", "wall_time", "rank", "loss", "acc"], [
  [number("0"), number("0"), number("10"), number("0"), number("2.5"), number("")],
  [number("1"), number("0"), number("10.5"), number("0"), number("1.25"), number("0.5")],
  [number("2"), number("1"), number("12.5"), number("0"), number("0.123456"), number("")],
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

  it("turns wall times into per-rank lanes of the gap before each logged step", () => {
    const ranks = table("demo.ddp.metrics", TableKind.Grid, ["step", "wall_time", "rank"], [
      ["0", "0", "0"], ["0", "0", "1"], ["1", "1", "0"], ["1", "3", "1"], ["2", "2", "0"], ["2", "4", "1"],
    ].map((row) => row.map(number)));
    expect(execution_strip_selector(ranks, 120)).toEqual({
      lanes: [
        { rank: "0", cells: [{ steps: "1", seconds: 1 }, { steps: "2", seconds: 1 }] },
        { rank: "1", cells: [{ steps: "1", seconds: 3 }, { steps: "2", seconds: 1 }] },
      ],
      median: 1,
      slowest: { steps: "1", seconds: 3 },
    });
    expect(execution_strip_selector(ranks, 1)!.lanes[1].cells).toEqual([{ steps: "1–2", seconds: 3 }]);
  });

  it("the run page shows the execution strip and keeps bookkeeping columns out of the stats", async () => {
    const run = table("demo.strip", TableKind.Folder, null, [
      [link("meta", "demo.strip.meta")],
      [link("metrics", "demo.strip.metrics")],
    ]);
    const stripMeta = { ...meta, source_path: "demo.strip.meta" };
    const stripMetrics = { ...metrics, source_path: "demo.strip.metrics" };
    useStore.getState().tables_setViews([run, stripMeta, stripMetrics].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter><MainView path="demo.strip" /></MemoryRouter>);
    expect(await screen.findByText(/slowest 2 s at step 2/)).toBeTruthy();
    expect(document.querySelectorAll(".execution-lane i")).toHaveLength(2);
    expect([...document.querySelectorAll(".stat > span")].map((label) => label.textContent)).toEqual([
      "status", "samples_seen", "step", "loss", "acc",
    ]);
  });

  it("a zoomed line keeps the whole run for the overview and every point inside the window", () => {
    const long = table("demo.long.metrics", TableKind.Grid, ["step", "loss"],
      Array.from({ length: 10_000 }, (_, step) => [number(String(step)), number(String(Math.sin(step)))]));
    const spec = chartSpec(long, Representation.Line, [5000, 5099]);
    const [line] = spec.data as { x: number[] }[];
    expect(line.x[0]).toBe(0);
    expect(line.x[line.x.length - 1]).toBe(9999);
    expect(spec.layout.annotations![0].text).toBe(String(Number(Math.sin(9999).toPrecision(4))));
    expect(new Set(line.x.filter((step) => step >= 5000 && step <= 5099)).size).toBe(100);
  });
});
