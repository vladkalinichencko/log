import type { Data, Layout } from "plotly.js";
import { Representation, Table } from "../types/domain";
import { SERIES } from "../store/slices/settingsSlice";
import { end_value, is_bookkeeping } from "../store/selectors/runSelectors";

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const theme = () => ({
  ink: token("--gray-900"),
  grid: token("--gray-200"),
  muted: token("--gray-400"),
  paper: token("--gray-0"),
  accent: token("--accent"),
  font: token("--font"),
  text: parseFloat(token("--text-meta")),
});

const baseLayout = (): Partial<Layout> => {
  const t = theme();
  return {
    autosize: true,
    paper_bgcolor: t.paper,
    plot_bgcolor: t.paper,
    font: { family: t.font, size: t.text, color: t.ink },
    margin: { l: 44, r: 16, t: 16, b: 32 },
    xaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    yaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    showlegend: false,
  };
};

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
  const kept = new Set([0, xs.length - 1]);
  for (let start = 0; start < xs.length; start += bucketSize) {
    let low = start;
    let high = start;
    for (let i = start; i < Math.min(start + bucketSize, xs.length); i++) {
      if (ys[i] < ys[low]) low = i;
      if (ys[i] > ys[high]) high = i;
    }
    kept.add(low).add(high);
  }
  const order = [...kept].sort((a, b) => a - b);
  return [order.map((i) => xs[i]), order.map((i) => ys[i])];
}

export function chartSpec(
  table: Table,
  representation: Representation,
  window: [number, number] | null = null
): { data: Data[]; layout: Partial<Layout> } {
  const cols = table.column_names ?? [];
  const last = (cols.length || 1) - 1;
  const t = theme();
  const base = baseLayout();

  if (representation === Representation.Line) {
    const xi = Math.max(0, cols.indexOf("step"));
    const x = column(table, xi);
    const palette = [t.accent, ...SERIES.map(token).filter((color) => color !== t.accent), t.muted];
    const series = cols
      .map((name, i) => ({ name, i }))
      .filter(({ name, i }) => i !== xi && !is_bookkeeping(name));
    const picked = (series.length > 0 ? series : [{ name: cols[last] ?? "", i: last }]).map(({ name, i }, order) => {
      const logged = table.cells.flatMap((row, index) => (row[i]?.value === "" ? [] : [index]));
      const sample = (indices: number[]) =>
        downsampleSeries(indices.map((index) => x[index]), indices.map((index) => Number(table.cells[index][i].value)));
      const [wideX, wideY] = sample(logged);
      const [closeX, closeY] = window
        ? sample(logged.filter((index) => x[index] >= window[0] && x[index] <= window[1]))
        : [[], []];
      const points = [...wideX.map((at, k) => [at, wideY[k]]), ...closeX.map((at, k) => [at, closeY[k]])]
        .sort((a, b) => a[0] - b[0]);
      const xs = points.map(([at]) => at);
      const ys = points.map(([, value]) => value);
      return { name, xs, ys, color: palette[order % palette.length] };
    });
    return {
      data: picked.map(({ name, xs, ys, color }) => ({
        x: xs,
        y: ys,
        name,
        type: "scatter" as const,
        mode: "lines" as const,
        line: { color, width: 2 },
      })),
      layout: {
        ...base,
        margin: { ...base.margin, r: 64 },
        showlegend: picked.length > 1,
        xaxis: { ...base.xaxis, ...(window ? { range: window } : {}) },
        annotations: picked
          .filter(({ xs }) => xs.length > 0)
          .map(({ xs, ys, color }) => {
            const last = xs.length - 1;
            const edge = window && xs[last] > window[1] ? xs.filter((at) => at <= window[1]).length - 1 : -1;
            const place = edge >= 0 ? { xref: "paper" as const, x: 1, y: ys[edge] } : { x: xs[last], y: ys[last] };
            return {
              ...place,
              text: edge >= 0 ? `${end_value(ys[last])} →` : end_value(ys[last]),
              xanchor: "left" as const,
              xshift: 4,
              showarrow: false,
              font: { color, size: t.text },
            };
          }),
      },
    };
  }

  if (representation === Representation.Histogram) {
    return {
      data: [{ x: column(table, last), type: "histogram", marker: { color: t.muted } }],
      layout: base,
    };
  }

  if (representation === Representation.Scatter) {
    return {
      data: [{ x: column(table, 0), y: column(table, 1), type: "scatter", mode: "markers", marker: { color: t.ink, size: 5 } }],
      layout: base,
    };
  }

  if (representation === Representation.Trajectory) {
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
