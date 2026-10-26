import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { App } from "../components/App";
import { MainView } from "../components/MainView";
import { useStore } from "../store/store";
import { Cell, CellType, LiveEvent, Representation, Table, TableKind } from "../types/domain";

const live: { send?: (event: LiveEvent) => void } = {};
const plotted: { data?: { yaxis?: string; x: number[]; text?: string[] }[]; layout?: object } = {};

vi.mock("../api/websocket", () => ({
  connectWebSocket: (onMessage: (event: LiveEvent) => void) => {
    live.send = onMessage;
    return { close: () => {} };
  },
}));

vi.mock("react-plotly.js", () => ({
  default: (props: typeof plotted) => {
    Object.assign(plotted, props);
    return null;
  },
}));

const cell = (type: CellType) => (value: string): Cell => ({ type: value === "" ? CellType.Empty : type, value, ref: null });
const number = cell(CellType.Number);
const text = cell(CellType.String);

const table = (source_path: string, kind: TableKind, column_names: string[] | null, cells: Cell[][]): Table => ({
  name: source_path.split(".").pop()!,
  kind,
  column_names,
  row_names: null,
  cells,
  representation: Representation.Grid,
  source_path,
});

afterEach(() => {
  vi.unstubAllGlobals();
  useStore.setState({ notices: [] });
});

describe("alerts", () => {
  it("an alert pushed over the socket becomes a notice whose Open goes to the run", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </MemoryRouter>
    );
    act(() => live.send!({ type: "alert", run: "demo/high_lr", step: 120, rule: "non_finite", path: "loss", message: "became nan", text: "demo.high_lr: loss became nan at step 120" }));
    expect(screen.getByRole("alert").textContent).toContain("demo.high_lr: loss became nan at step 120");
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("high_lr");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the run page puts every alert step in the alerts lane under the hero chart", async () => {
    const run = table("demo.flags", TableKind.Folder, null, [
      [{ type: CellType.TableRef, value: "meta", ref: "demo.flags.meta" }],
      [{ type: CellType.TableRef, value: "metrics", ref: "demo.flags.metrics" }],
      [{ type: CellType.TableRef, value: "alerts", ref: "demo.flags.alerts" }],
    ]);
    const meta = table("demo.flags.meta", TableKind.Column, ["key", "value"], [[text("status"), text("running")]]);
    const metrics = table("demo.flags.metrics", TableKind.Grid, ["step", "epoch", "wall_time", "rank", "loss"],
      [0, 1, 2, 3].map((step) => [String(step), "0", String(step), "0", "1"].map(number)));
    const alerts = table("demo.flags.alerts", TableKind.Grid, ["step", "rule", "path", "message", "value", "epoch", "wall_time", "rank"], [
      [number("2"), text("spike"), text("loss"), text("is +6.0 standard deviations"), number("9"), number("0"), number("2"), number("0")],
      [number(""), text("heartbeat"), text("run"), text("has logged nothing for 10 min"), number("600"), number("0"), number("0"), number("0")],
    ]);
    useStore.getState().tables_setViews([run, meta, metrics, alerts].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter><MainView path="demo.flags" /></MemoryRouter>);
    await vi.waitFor(() => expect(plotted.layout).toBeDefined());
    const lanes = plotted.data!.filter((trace) => trace.yaxis === "y2");
    expect(lanes.map((lane) => [lane.x, lane.text])).toEqual([[[2], ["loss is +6.0 standard deviations"]]]);
  });
});
