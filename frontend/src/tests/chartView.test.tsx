import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
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
    render(<Chart table={metrics} representation={Representation.Line} hero />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    act(() => plotted.props!.onRelayout(event));
    expect(plotted.props!.layout.annotations[0]).toMatchObject({ xref: "paper", text: "0.001 →" });
  });
});

describe("hero chart", () => {
  const graph = {
    _fullLayout: { xaxis: { range: [0, 2000], l2p: (x: number) => x / 10 }, yaxis: { range: [0, 1], l2p: (y: number) => 100 - y * 100 }, _size: { l: 44, t: 16 } },
  };
  const grown = { ...metrics, cells: [...metrics.cells, [number("1000"), number("0.5")]] };

  it("a newly landed point sends one pulse from the newest dot, the first draw does not", async () => {
    const { rerender } = render(<Chart table={metrics} representation={Representation.Line} hero />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    const update = () => act(() => (plotted.props as unknown as { onUpdate: (figure: object, graph: object) => void }).onUpdate({}, graph));
    update();
    expect(document.querySelectorAll(".chart-pulse")).toHaveLength(0);
    rerender(<Chart table={grown} representation={Representation.Line} hero />);
    update();
    const pulse = document.querySelector<HTMLElement>(".chart-pulse")!;
    expect([pulse.style.left, pulse.style.top]).toEqual(["144px", "66px"]);
    update();
    expect(document.querySelectorAll(".chart-pulse")).toHaveLength(1);
  });

  it("the summary line describes the whole run, then the window a clicked flag selects", async () => {
    render(<Chart table={metrics} representation={Representation.Line} hero marks={[{ x: 500, label: "loss spiked" }]} />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    expect(document.querySelector(".chart-summary")!.textContent).toBe("steps 0–999 · loss 1 → 0.001 (−99.9%) · min 0.001 · max 1");
    act(() => (plotted.props as unknown as { onClickAnnotation: (event: object) => void }).onClickAnnotation({ annotation: { x: 500 } }));
    expect(document.querySelector(".chart-summary")!.textContent).toMatch(/^steps 451–549 · loss /);
  });
});
