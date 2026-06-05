import type { Data, Layout } from "plotly.js";
import { Table } from "../types/domain";

const INK = "#1c1c1c";
const GRID = "#e6e6e6";

const base: Partial<Layout> = {
  paper_bgcolor: "white",
  plot_bgcolor: "white",
  font: { family: "system-ui, sans-serif", size: 12, color: INK },
  margin: { l: 44, r: 16, t: 16, b: 32 },
  xaxis: { gridcolor: GRID, zerolinecolor: GRID },
  yaxis: { gridcolor: GRID, zerolinecolor: GRID },
  showlegend: false,
};

type Kind = "line" | "histogram" | "heatmap";

function column(table: Table, index: number): number[] {
  return table.cells.map((row) => Number(row[index].value));
}

export function chartSpec(table: Table, kind: Kind): { data: Data[]; layout: Partial<Layout> } {
  const cols = table.column_names ?? [];
  const last = (cols.length || 1) - 1;

  if (kind === "line") {
    const xi = Math.max(0, cols.indexOf("step"));
    return {
      data: [{ x: column(table, xi), y: column(table, last), type: "scatter", mode: "lines", line: { color: INK } }],
      layout: base,
    };
  }

  if (kind === "histogram") {
    return {
      data: [{ x: column(table, last), type: "histogram", marker: { color: "#6b6b6b" } }],
      layout: base,
    };
  }

  const z = table.cells.map((row) => row.map((cell) => Number(cell.value)));
  return {
    data: [{ z, type: "heatmap", colorscale: "Greys", showscale: false }],
    layout: { ...base, yaxis: { ...base.yaxis, autorange: "reversed" } },
  };
}
