import { Table } from "../../types/domain";

export const end_value = (value: number) => String(Number(value.toPrecision(4)));

export const BOOKKEEPING = ["step", "epoch", "samples_seen", "wall_time", "rank"];

export const is_bookkeeping = (name: string) => BOOKKEEPING.includes(name.replace(/_\d+$/, ""));

export const duration = (seconds: number) =>
  seconds < 1 ? `${end_value(seconds * 1000)} ms` : `${end_value(seconds)} s`;

export interface RunStat {
  label: string;
  value: string;
  trend: number[];
}

const RUN_FACTS = ["status", "samples_seen"];

export function run_stats_selector(meta: Table, metrics: Table): RunStat[] {
  const facts = new Map(meta.cells.map(([key, value]) => [key.value, value.value]));
  const steps = metrics.cells.map((row) => row[0].value);
  const scalars = (metrics.column_names ?? []).flatMap((label, column) => {
    if (is_bookkeeping(label)) return [];
    const trend = metrics.cells.flatMap((row) => (row[column].value === "" ? [] : [Number(row[column].value)]));
    return [{ label, value: trend.length ? end_value(trend[trend.length - 1]) : "", trend }];
  });
  return [
    ...RUN_FACTS.flatMap((key) => (facts.has(key) ? [{ label: key, value: facts.get(key)!, trend: [] }] : [])),
    ...(steps.length ? [{ label: "step", value: steps[steps.length - 1], trend: [] }] : []),
    ...scalars,
  ];
}

export interface ExecutionCell {
  steps: string;
  seconds: number;
}

export interface ExecutionStrip {
  lanes: { rank: string; cells: ExecutionCell[] }[];
  median: number;
  slowest: ExecutionCell;
}

export function execution_strip_selector(metrics: Table, columns: number): ExecutionStrip | null {
  const names = metrics.column_names ?? [];
  const [step, wall, rank] = ["step", "wall_time", "rank"].map((name) => names.indexOf(name));
  if (wall < 0) return null;
  const gaps = new Map<string, ExecutionCell[]>();
  const last = new Map<string, number>();
  for (const row of metrics.cells) {
    const lane = rank < 0 ? "0" : row[rank].value;
    const time = Number(row[wall].value);
    if (last.has(lane)) gaps.set(lane, [...(gaps.get(lane) ?? []), { steps: row[step].value, seconds: time - last.get(lane)! }]);
    last.set(lane, time);
  }
  const all = [...gaps.values()].flat();
  if (all.length === 0) return null;
  const lanes = [...gaps].map(([lane, cells]) => {
    const size = Math.ceil(cells.length / columns);
    return {
      rank: lane,
      cells: Array.from({ length: Math.ceil(cells.length / size) }, (_, i) => {
        const bucket = cells.slice(i * size, (i + 1) * size);
        const seconds = Math.max(...bucket.map((cell) => cell.seconds));
        const first = bucket[0].steps;
        const final = bucket[bucket.length - 1].steps;
        return { steps: first === final ? first : `${first}–${final}`, seconds };
      }),
    };
  });
  const sorted = all.map((cell) => cell.seconds).sort((a, b) => a - b);
  const middle = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2;
  const slowest = all.reduce((worst, cell) => (cell.seconds > worst.seconds ? cell : worst));
  return { lanes, median, slowest };
}
