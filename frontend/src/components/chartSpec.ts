import type { Data, Layout } from "plotly.js";
import { Table } from "../types/domain";

const INK = "#1c1c1c";
const GRID = "#e6e6e6";
const MUTED = "#b4b4b4";

const base: Partial<Layout> = {
  autosize: true,
  paper_bgcolor: "white",
  plot_bgcolor: "white",
  font: { family: "system-ui, sans-serif", size: 12, color: INK },
  margin: { l: 44, r: 16, t: 16, b: 32 },
  xaxis: { gridcolor: GRID, zerolinecolor: GRID },
  yaxis: { gridcolor: GRID, zerolinecolor: GRID },
  showlegend: false,
};

type Kind = "line" | "histogram" | "heatmap" | "scatter" | "trajectory";

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

  if (kind === "scatter") {
    return {
      data: [{ x: column(table, 0), y: column(table, 1), type: "scatter", mode: "markers", marker: { color: INK, size: 5 } }],
      layout: base,
    };
  }

  if (kind === "trajectory") {
    const steps = column(table, 0);
    const points = column(table, 1);
    const xs = column(table, 2);
    const ys = column(table, 3);
    const lastStep = Math.max(...steps);
    const trailX: (number | null)[] = [];
    const trailY: (number | null)[] = [];
    const headX: number[] = [];
    const headY: number[] = [];
    for (const point of [...new Set(points)]) {
      for (let i = 0; i < points.length; i++) {
        if (points[i] !== point) continue;
        trailX.push(xs[i]);
        trailY.push(ys[i]);
        if (steps[i] === lastStep) {
          headX.push(xs[i]);
          headY.push(ys[i]);
        }
      }
      trailX.push(null);
      trailY.push(null);
    }
    return {
      data: [
        { x: trailX, y: trailY, type: "scatter", mode: "lines", line: { color: MUTED, width: 1 } },
        { x: headX, y: headY, type: "scatter", mode: "markers", marker: { color: INK, size: 6 } },
      ],
      layout: base,
    };
  }

  const z = table.cells.map((row) => row.map((cell) => Number(cell.value)));
  return {
    data: [{ z, type: "heatmap", colorscale: "Greys", showscale: false }],
    layout: { ...base, yaxis: { ...base.yaxis, autorange: "reversed" } },
  };
}
