import type { Data, Layout } from "plotly.js";
import { Table } from "../types/domain";

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const theme = () => ({
  ink: token("--gray-900"),
  grid: token("--gray-200"),
  muted: token("--gray-400"),
  paper: token("--gray-0"),
  accent: token("--accent"),
  font: token("--font"),
});

const baseLayout = (): Partial<Layout> => {
  const t = theme();
  return {
    autosize: true,
    paper_bgcolor: t.paper,
    plot_bgcolor: t.paper,
    font: { family: t.font, size: 12, color: t.ink },
    margin: { l: 44, r: 16, t: 16, b: 32 },
    xaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    yaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    showlegend: false,
  };
};

type Kind = "line" | "histogram" | "heatmap" | "scatter" | "trajectory";

function column(table: Table, index: number): number[] {
  return table.cells.map((row) => Number(row[index].value));
}

export function downsampleSeries(
  xs: number[],
  ys: number[],
  target = 2000
): [number[], number[]] {
  if (xs.length <= target) return [xs, ys];
  const bucketSize = Math.ceil(xs.length / (target / 2));
  const outX: number[] = [];
  const outY: number[] = [];
  for (let start = 0; start < xs.length; start += bucketSize) {
    let low = start;
    let high = start;
    for (let i = start; i < Math.min(start + bucketSize, xs.length); i++) {
      if (ys[i] < ys[low]) low = i;
      if (ys[i] > ys[high]) high = i;
    }
    for (const i of [low, high].sort((a, b) => a - b)) {
      outX.push(xs[i]);
      outY.push(ys[i]);
    }
  }
  return [outX, outY];
}

export function chartSpec(
  table: Table,
  kind: Kind,
  window: [number, number] | null = null
): { data: Data[]; layout: Partial<Layout> } {
  const cols = table.column_names ?? [];
  const last = (cols.length || 1) - 1;
  const t = theme();
  const base = baseLayout();

  if (kind === "line") {
    const xi = Math.max(0, cols.indexOf("step"));
    const x = column(table, xi);
    const palette = [t.accent, "#3b82f6", "#a855f7", "#34d399", "#f59e0b", t.muted];
    const bookkeeping = ["samples_seen", "wall_time", "rank"];
    const series = cols
      .map((name, i) => ({ name, i }))
      .filter(({ name, i }) => i !== xi && !bookkeeping.includes(name.replace(/_\d+$/, "")));
    const picked = series.length > 0 ? series : [{ name: cols[last] ?? "", i: last }];
    return {
      data: picked.map(({ name, i }, order) => {
        const y = column(table, i);
        const visible = window
          ? x.reduce<number[]>((kept, value, index) => {
              if (value >= window[0] && value <= window[1]) kept.push(index);
              return kept;
            }, [])
          : x.map((_, index) => index);
        const [xs, ys] = downsampleSeries(
          visible.map((index) => x[index]),
          visible.map((index) => y[index])
        );
        return {
          x: xs,
          y: ys,
          name,
          type: "scatter" as const,
          mode: "lines" as const,
          line: { color: palette[order % palette.length], width: 2 },
        };
      }),
      layout: {
        ...base,
        showlegend: picked.length > 1,
        xaxis: { ...base.xaxis, ...(window ? { range: window } : {}) },
      },
    };
  }

  if (kind === "histogram") {
    return {
      data: [{ x: column(table, last), type: "histogram", marker: { color: t.muted } }],
      layout: base,
    };
  }

  if (kind === "scatter") {
    return {
      data: [{ x: column(table, 0), y: column(table, 1), type: "scatter", mode: "markers", marker: { color: t.ink, size: 5 } }],
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
        { x: trailX, y: trailY, type: "scatter", mode: "lines", line: { color: t.muted, width: 1 } },
        { x: headX, y: headY, type: "scatter", mode: "markers", marker: { color: t.ink, size: 6 } },
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
