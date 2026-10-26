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
    render(<Chart table={metrics} representation={Representation.Line} overview />);
    await vi.waitFor(() => expect(plotted.props).toBeDefined());
    act(() => plotted.props!.onRelayout(event));
    expect(plotted.props!.layout.annotations[0]).toMatchObject({ xref: "paper", text: "0.001 →" });
  });
});
