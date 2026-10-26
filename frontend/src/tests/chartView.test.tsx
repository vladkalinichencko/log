import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Chart } from "../modules/chart";
import { CellType, Representation, Table, TableKind } from "../types/domain";

const plotted: { props?: { layout: { annotations: object[] }; onRelayout: (event: object) => void } } = {};

vi.mock("react-plotly.js", () => ({
  default: (props: typeof plotted.props) => {
    plotted.props = props;
    return null;
  },
}));

const number = (value: string) => ({ type: CellType.Number, value, ref: null });

const metrics: Table = {
  name: "metrics",
  kind: TableKind.Grid,
  column_names: ["step", "loss"],
  row_names: null,
  cells: Array.from({ length: 1000 }, (_, step) => [number(String(step)), number(String(1 / (step + 1)))]),
  representation: Representation.Line,
  source_path: "p.r.metrics",
};

describe("Chart", () => {
  it.each([
    ["the range slider", { "xaxis.range": [0, 200] }],
    ["a drag zoom", { "xaxis.range[0]": 0, "xaxis.range[1]": 200 }],
  ])("%s narrows the window, which pins the latest value to the right edge", async (_, event) => {
    render(<Chart table={metrics} representation={Representation.Line} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    act(() => plotted.props!.onRelayout(event));
    expect(plotted.props!.layout.annotations[0]).toMatchObject({ xref: "paper", text: "0.001 →" });
  });
});

describe("hero chart", () => {
  const graph = {
    _fullLayout: { xaxis: { range: [0, 2000], _offset: 44, l2p: (x: number) => x / 10 }, yaxis: { range: [0, 1], _offset: 16, l2p: (y: number) => 100 - y * 100 } },
  };
  const grown = { ...metrics, cells: [...metrics.cells, [number("1000"), number("0.5")]] };

  it("a newly landed point sends one pulse from the newest dot, the first draw does not", async () => {
    const { rerender } = render(<Chart table={metrics} representation={Representation.Line} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    const update = () => act(() => (plotted.props as unknown as { onUpdate: (figure: object, graph: object) => void }).onUpdate({}, graph));
    update();
    expect(document.querySelectorAll(".chart-pulse")).toHaveLength(0);
    rerender(<Chart table={grown} representation={Representation.Line} />);
    update();
    const pulse = document.querySelector<HTMLElement>(".chart-pulse")!;
    expect([pulse.style.left, pulse.style.top]).toEqual(["144px", "66px"]);
    update();
    expect(document.querySelectorAll(".chart-pulse")).toHaveLength(1);
  });

  it("the summary line describes the whole run, then the window a clicked alert in its lane selects", async () => {
    render(<Chart table={metrics} representation={Representation.Line} marks={[{ x: 500, label: "loss spiked", kind: "alert" }]} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    expect(document.querySelector(".chart-summary")!.textContent).toBe("steps 0–999 · loss 1 → 0.001 (−99.9%) · min 0.001 · max 1");
    act(() => (plotted.props as unknown as { onClick: (event: object) => void }).onClick({ points: [{ x: 500, data: { yaxis: "y2" } }] }));
    expect(document.querySelector(".chart-summary")!.textContent).toMatch(/^steps 451–549 · loss /);
  });
});

describe("one chart at every size", () => {
  const two = {
    ...metrics,
    column_names: ["step", "a", "b"],
    cells: Array.from({ length: 10 }, (_, step) => [number(String(step)), number(String(10 - step)), number(String(step))]),
  };
  const layout = () => (plotted.props as unknown as { layout: { xaxis: Record<string, unknown>; annotations: { text: string; font: { size: number } }[]; hovermode: string } }).layout;
  const traces = () => (plotted.props as unknown as { data: { name?: string; opacity?: number }[] }).data;

  it("several lines get legend chips; pointing at one spotlights it and the summary describes it", async () => {
    render(<Chart table={two} representation={Representation.Line} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    expect([...document.querySelectorAll(".chart-chip")].map((chip) => chip.textContent)).toEqual(["a", "b"]);
    expect(document.querySelector(".chart-summary")!.textContent).toBe(" ");
    act(() => fireEvent.mouseEnter(screen.getByText("b").closest("button")!));
    expect(traces().filter((trace) => trace.name).map((trace) => [trace.name, trace.opacity])).toEqual([["a", 0.2], ["b", 1]]);
    expect(layout().annotations.map((label) => [label.text, (label as unknown as { opacity: number }).opacity])).toEqual([["1", 0.2], ["9", 1]]);
    expect(document.querySelector(".chart-summary")!.textContent).toBe("steps 0–9 · b 0 → 9 (—) · min 0 · max 9");
    expect(layout().hovermode).toBe("x unified");
    expect(layout().xaxis).toMatchObject({ showspikes: true, spikemode: "across" });
  });

  it.each([
    [250, false],
    [400, true],
  ])("a plot %ipx tall shows the overview strip and large end values: %s", async (height, roomy) => {
    vi.stubGlobal("ResizeObserver", class {
      constructor(private report: (entries: { contentRect: { height: number } }[]) => void) {}
      observe() { this.report([{ contentRect: { height } }]); }
      disconnect() {}
    });
    render(<Chart table={metrics} representation={Representation.Line} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    await vi.waitFor(() => expect(Boolean(layout().xaxis.rangeslider)).toBe(roomy));
    expect(layout().annotations[layout().annotations.length - 1].text.startsWith("<b>")).toBe(roomy);
    vi.unstubAllGlobals();
  });
});

describe("a series with a NaN", () => {
  it("keeps its summary and gradient on the finite values", async () => {
    const broken = { ...metrics, cells: [["0", "2"], ["1", "nan"], ["2", "1"]].map((row) => row.map(number)) };
    render(<Chart table={broken} representation={Representation.Line} />);
    await vi.waitFor(() => expect(document.querySelector(".chart-summary")!.textContent).toBe("steps 0–2 · loss 2 → 1 (−50%) · min 1 · max 2"));
    const [baseline] = (plotted.props as unknown as { data: { y: number[] }[] }).data;
    expect(baseline.y).toEqual([1, 1, 1]);
  });
});

describe("a series with no finite value", () => {
  it("draws no fill instead of an infinite baseline", async () => {
    const diverged = { ...metrics, cells: [["0", "nan"], ["1", "inf"]].map((row) => row.map(number)) };
    render(<Chart table={diverged} representation={Representation.Line} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    const data = (plotted.props as unknown as { data: { y: number[]; fill?: string }[] }).data;
    expect(data.flatMap((trace) => trace.y).some((y) => y === Infinity || y === -Infinity)).toBe(false);
    expect(data.some((trace) => trace.fill)).toBe(false);
  });
});
