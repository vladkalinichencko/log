import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RunComparison } from "../components/RunComparison";
import { MainView } from "../components/MainView";
import { useStore } from "../store/store";
import { Cell, CellType, Representation, Table, TableKind } from "../types/domain";

const plotted: { data?: { name?: string; yaxis?: string; x: number[]; text?: string[] }[]; layout?: object } = {};

vi.mock("react-plotly.js", () => ({
  default: (props: typeof plotted) => {
    Object.assign(plotted, props);
    return null;
  },
}));

const cell = (value: string): Cell => ({ type: value === "" ? CellType.Empty : CellType.Number, value, ref: null });
const text = (value: string): Cell => ({ type: CellType.String, value, ref: null });
const grid = (source_path: string, column_names: string[], rows: string[][]): Table => ({
  name: source_path.split(".").pop()!,
  kind: TableKind.Grid,
  column_names,
  row_names: null,
  cells: rows.map((row) => row.map(cell)),
  representation: Representation.Line,
  source_path,
});

const evaluated: string[] = [];

function stubApi(answers: Record<string, Table>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const expression = init?.body && JSON.parse(String(init.body)).expression;
    if (expression) evaluated.push(expression);
    const path = new URL(url, "http://x").searchParams.get("path");
    const body = url.includes("/settings") ? { hero: null, alerts: {} } : answers[expression ?? path ?? url];
    return body ? new Response(JSON.stringify(body)) : new Promise(() => {});
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  evaluated.length = 0;
  for (const key of Object.keys(plotted)) delete plotted[key as keyof typeof plotted];
});

const series = () => plotted.data!.filter((trace) => trace.name).map((trace) => [trace.name, trace.x]);

describe("overlay and splice", () => {
  it("comparing runs overlays one metric of every run in one chart, and the picker switches the metric", async () => {
    stubApi({
      "demo.a.metrics": grid("demo.a.metrics", ["step", "epoch", "wall_time", "rank", "loss", "acc", "train/loss"], [["0", "0", "0", "0", "2", "0.1", "3"]]),
      "overlay(loss, demo.a, demo.b)": grid("result", ["step", "demo.a", "demo.b"], [["0", "2", ""], ["1", "", "3"]]),
      "overlay(acc, demo.a, demo.b)": grid("result", ["step", "demo.a", "demo.b"], [["0", "0.1", "0.2"]]),
    });
    render(<MemoryRouter initialEntries={["/demo?compare=demo.a,demo.b"]}><RunComparison path="demo" /></MemoryRouter>);
    await waitFor(() => expect(plotted.data).toBeDefined());
    expect(series()).toEqual([["demo.a", [0]], ["demo.b", [1]]]);
    expect(screen.getByText("overlay(loss, demo.a, demo.b)")).toBeTruthy();
    fireEvent.click(screen.getByText("loss ▾"));
    fireEvent.click(screen.getByRole("menuitem", { name: "acc" }));
    await waitFor(() => expect(evaluated).toContain("overlay(acc, demo.a, demo.b)"));
    fireEvent.click(screen.getByText("acc ▾"));
    fireEvent.click(screen.getByRole("menuitem", { name: "train/loss" }));
    await waitFor(() => expect(evaluated).toContain('overlay("train/loss", demo.a, demo.b)'));
  });

  it("a resumed run draws the run it continues before it as one line, flagged where it resumed", async () => {
    const run = grid("demo.b", [], []);
    const folder = { ...run, kind: TableKind.Folder, column_names: null, cells: [[{ type: CellType.TableRef, value: "metrics", ref: "demo.b.metrics" }]] };
    const meta = { ...grid("demo.b.meta", ["key", "value"], []), kind: TableKind.Column, cells: [[text("status"), text("finished")], [text("resume_diff"), text('{"resumed_from_step": 2, "resumed_from_run": "demo.a"}')]] };
    stubApi({
      "demo.b.metrics": grid("demo.b.metrics", ["step", "epoch", "wall_time", "rank", "loss"], [["2", "0", "0", "0", "5"], ["3", "0", "1", "0", "4"]]),
      "demo.b.alerts": grid("demo.b.alerts", ["step", "rule", "path", "message"], []),
      "splice(demo.a, demo.b)": {
        ...grid("result", ["step", "loss", "segment"], []),
        cells: [["0", "9", "demo.a"], ["1", "8", "demo.a"], ["2", "5", "demo.b"], ["3", "4", "demo.b"]].map(([step, loss, segment]) => [cell(step), cell(loss), text(segment)]),
      },
    });
    useStore.getState().tables_setViews([folder, meta].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter initialEntries={["/demo.b"]}><MainView path="demo.b" /></MemoryRouter>);
    await waitFor(() => expect(series()).toEqual([["loss", [2, 3]]]));
    fireEvent.click(await screen.findByText("resumed from demo.a"));
    await waitFor(() => expect(series()).toEqual([["demo.b", [2, 3]], ["demo.a", [0, 1]]]));
    expect(evaluated).toEqual(["splice(demo.a, demo.b)"]);
    expect(plotted.data!.filter((trace) => trace.yaxis === "y2").map((lane) => [lane.x, lane.text])).toEqual([[[2], ["resumed from demo.a"]]]);
  });
});
