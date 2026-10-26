import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainView } from "../components/MainView";
import { applicable } from "../components/render";
import { chartSpec } from "../modules/chart/plotly";
import { useStore } from "../store/store";
import { Cell, CellType, Representation, Table, TableKind } from "../types/domain";

const plotted: { layout?: { shapes: { x0: number; line: { dash: string } }[]; annotations: { text: string; hovertext?: string }[] } } = {};

vi.mock("react-plotly.js", () => ({
  default: (props: typeof plotted) => {
    Object.assign(plotted, props);
    return null;
  },
}));

const cell = (value: string): Cell => ({ type: value === "" ? CellType.Empty : /^-?[\d.]+$/.test(value) ? CellType.Number : CellType.String, value, ref: null });
const grid = (source_path: string, column_names: string[], rows: string[][]): Table => ({
  name: source_path.split(".").pop()!,
  kind: TableKind.Grid,
  column_names,
  row_names: null,
  cells: rows.map((row) => row.map(cell)),
  representation: Representation.Grid,
  source_path,
});
const link = (name: string, ref: string): Cell[] => [{ type: CellType.TableRef, value: name, ref }];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(plotted)) delete plotted[key as keyof typeof plotted];
});

describe("training timeline", () => {
  it("a trace draws as a flame: one bar per event from its start, stacked by depth, the lane named once", () => {
    const trace = grid("demo.r.trace", ["lane", "depth", "name", "start", "duration"], [
      ["main", "0", "step", "0", "1"], ["main", "1", "forward", "0", "0.4"], ["main", "1", "backward", "0.4", "0.6"], ["autograd", "0", "mm", "0.5", "0.1"],
    ]);
    expect(applicable(trace)).toContain(Representation.Flame);
    const spec = chartSpec({ table: trace, representation: Representation.Flame });
    const [bars] = spec.data as unknown as { base: number[]; x: number[]; y: string[]; text: string[] }[];
    expect([bars.base, bars.x, bars.text]).toEqual([[0, 0, 0.4, 0.5], [1, 0.4, 0.6, 0.1], ["step", "forward", "backward", "mm"]]);
    expect(spec.layout.yaxis).toMatchObject({ categoryarray: ["autograd · 0", "main · 0", "main · 1"], ticktext: ["autograd", "main", ""] });
  });

  it("the run page flags epochs and checkpoints on the hero and splits the execution strip into phases", async () => {
    const run = { ...grid("demo.t", [], []), kind: TableKind.Folder, column_names: null, cells: [link("metrics", "demo.t.metrics"), link("checkpoints", "demo.t.checkpoints"), link("spans", "demo.t.spans")] };
    const meta = { ...grid("demo.t.meta", ["key", "value"], [["status", "running"]]), kind: TableKind.Column };
    const metrics = grid("demo.t.metrics", ["step", "epoch", "wall_time", "rank", "loss"], [["0", "0", "0", "0", "2"], ["1", "0", "1", "0", "1.5"], ["2", "1", "2", "0", "1"]]);
    const checkpoints = grid("demo.t.checkpoints", ["tag", "step", "metric"], [["s1", "1", ""]]);
    const spans = grid("demo.t.spans", ["step", "rank", "name", "parent", "depth", "start", "duration"], [
      ["0", "0", "forward", "step", "1", "0", "0.1"], ["0", "0", "backward", "step", "1", "0.1", "0.3"], ["0", "0", "step", "", "0", "0", "0.4"],
      ["1", "0", "forward", "step", "1", "1", "0.1"], ["1", "0", "backward", "step", "1", "1.1", "0.3"], ["1", "0", "step", "", "0", "1", "0.4"],
    ]);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    useStore.getState().tables_setViews([run, meta, metrics, checkpoints, spans].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter><MainView path="demo.t" /></MemoryRouter>);
    await waitFor(() => expect(plotted.layout?.shapes).toHaveLength(2));
    expect(plotted.layout!.shapes.map((shape) => [shape.x0, shape.line.dash])).toEqual([[2, "solid"], [1, "dot"]]);
    expect(plotted.layout!.annotations.slice(0, 2).map((label) => [label.text, label.hovertext])).toEqual([["epoch 1", undefined], ["◆", "checkpoint s1"]]);
    expect([...document.querySelectorAll(".execution-track span")].map((phase) => phase.textContent)).toEqual(["forward 25%", "backward 75%"]);
  });

  it("a run whose metrics fail to load shows the error instead of crashing the page", async () => {
    const run = { ...grid("demo.broken", [], []), kind: TableKind.Folder, column_names: null, cells: [link("metrics", "demo.broken.metrics")] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("demo.broken.metrics") ? new Response(JSON.stringify({ error: { code: "X", message: "metrics unreadable" } }), { status: 500 }) : new Promise(() => {}))));
    useStore.getState().tables_setViews([run].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter><MainView path="demo.broken" /></MemoryRouter>);
    expect(await screen.findByText("metrics unreadable")).toBeTruthy();
  });
});
