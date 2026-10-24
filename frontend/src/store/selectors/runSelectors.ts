import { Table } from "../../types/domain";

export const end_value = (value: number) => String(Number(value.toPrecision(4)));

export interface RunStat {
  label: string;
  value: string;
  trend: number[];
}

const RUN_FACTS = ["status", "samples_seen"];

export function run_stats_selector(meta: Table, metrics: Table): RunStat[] {
  const facts = new Map(meta.cells.map(([key, value]) => [key.value, value.value]));
  const steps = metrics.cells.map((row) => row[0].value);
  const scalars = (metrics.column_names ?? []).slice(2).map((label, offset) => {
    const trend = metrics.cells.flatMap((row) => (row[offset + 2].value === "" ? [] : [Number(row[offset + 2].value)]));
    return { label, value: trend.length ? end_value(trend[trend.length - 1]) : "", trend };
  });
  return [
    ...RUN_FACTS.flatMap((key) => (facts.has(key) ? [{ label: key, value: facts.get(key)!, trend: [] }] : [])),
    ...(steps.length ? [{ label: "step", value: steps[steps.length - 1], trend: [] }] : []),
    ...scalars,
  ];
}
