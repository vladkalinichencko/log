import { Table } from "../../types/domain";
import { end_value, is_bookkeeping } from "../../store/selectors/runSelectors";

export type ChartWindow = [number, number] | null;

const MARK_REACH = 0.05;
const LABEL_GAP = 0.05;
const CATEGORICAL_ORDER = ["--series-1", "--series-5", "--series-6", "--series-3", "--series-2", "--series-4"];

export interface LineSeries {
  name: string;
  xs: number[];
  ys: number[];
  color: string;
}

export interface WindowSummary {
  from: number;
  to: number;
  first: number;
  last: number;
  min: number;
  max: number;
}

export interface EndLabel {
  edge: boolean;
  x: number;
  y: number;
  text: string;
  color: string;
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const chart_theme = () => ({
  ink: token("--gray-900"),
  grid: token("--gray-200"),
  muted: token("--gray-400"),
  paper: token("--gray-0"),
  accent: token("--accent"),
  warning: token("--warning"),
  pulse: parseFloat(token("--motion-pulse")) || 0,
  font: token("--font"),
  text: parseFloat(token("--text-meta")),
  palette: [token("--accent"), ...CATEGORICAL_ORDER.map(token).filter((color) => color !== token("--accent")), token("--gray-400")],
});

export const column = (table: Table, index: number) => table.cells.map((row) => Number(row[index].value));

export function downsampleSeries(xs: number[], ys: number[], target = 2000): [number[], number[]] {
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

export function line_series_selector(table: Table, window: ChartWindow, palette: string[]): LineSeries[] {
  const cols = table.column_names ?? [];
  const last = (cols.length || 1) - 1;
  const xi = Math.max(0, cols.indexOf("step"));
  const x = column(table, xi);
  const series = cols.map((name, i) => ({ name, i })).filter(({ name, i }) => i !== xi && !is_bookkeeping(name));
  return (series.length > 0 ? series : [{ name: cols[last] ?? "", i: last }]).map(({ name, i }, order) => {
    const logged = table.cells.flatMap((row, index) => (row[i]?.value === "" ? [] : [index]));
    const sample = (indices: number[]) =>
      downsampleSeries(indices.map((index) => x[index]), indices.map((index) => Number(table.cells[index][i].value)));
    const [wideX, wideY] = sample(logged);
    const [closeX, closeY] = window ? sample(logged.filter((index) => x[index] >= window[0] && x[index] <= window[1])) : [[], []];
    const points = [...wideX.map((at, k) => [at, wideY[k]]), ...closeX.map((at, k) => [at, closeY[k]])].sort((a, b) => a[0] - b[0]);
    return { name, xs: points.map(([at]) => at), ys: points.map(([, value]) => value), color: palette[order % palette.length] };
  });
}

export function end_label_selector({ xs, ys, color }: LineSeries, window: ChartWindow): EndLabel | null {
  const last = xs.length - 1;
  if (last < 0) return null;
  const edge = window && xs[last] > window[1] ? xs.filter((at) => at <= window[1]).length - 1 : -1;
  return edge >= 0
    ? { edge: true, x: window![1], y: ys[edge], text: `${end_value(ys[last])} →`, color }
    : { edge: false, x: xs[last], y: ys[last], text: end_value(ys[last]), color };
}

export function window_summary_selector({ xs, ys }: LineSeries, window: ChartWindow): WindowSummary | null {
  const inside = xs.flatMap((at, i) => (!window || (at >= window[0] && at <= window[1]) ? [i] : []));
  if (inside.length === 0) return null;
  const values = inside.map((i) => ys[i]);
  return { from: xs[inside[0]], to: xs[inside[inside.length - 1]], first: values[0], last: values[values.length - 1], min: Math.min(...values), max: Math.max(...values) };
}

export function mark_window(at: number, xs: number[]): [number, number] {
  const reach = (xs[xs.length - 1] - xs[0]) * MARK_REACH || 1;
  return [at - reach, at + reach];
}

export function separate_labels(labels: EndLabel[], series: LineSeries[]): EndLabel[] {
  const values = series.flatMap(({ ys }) => ys);
  const gap = (Math.max(...values) - Math.min(...values)) * LABEL_GAP;
  const placed: EndLabel[] = [];
  for (const label of [...labels].sort((a, b) => a.y - b.y)) {
    const below = placed.filter((other) => other.edge === label.edge && other.x === label.x).pop();
    placed.push(below && label.y - below.y < gap ? { ...label, y: below.y + gap } : label);
  }
  return placed;
}
