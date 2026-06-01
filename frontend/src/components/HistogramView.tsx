import { Table } from "../types/domain";

interface HistogramViewProps {
  table: Table;
}

const W = 600;
const H = 200;
const BINS = 10;

export function HistogramView({ table }: HistogramViewProps) {
  const cols = table.column_names;
  if (!cols || table.cells.length === 0) return <div>{table.name}</div>;

  const yi = cols.length - 1;
  const values = table.cells.map((row) => Number(row[yi].value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const counts = new Array(BINS).fill(0);
  for (const v of values) {
    const bin = max === min ? 0 : Math.min(BINS - 1, Math.floor(((v - min) / (max - min)) * BINS));
    counts[bin] += 1;
  }
  const maxCount = Math.max(...counts);
  const barWidth = W / BINS;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      {counts.map((count, i) => {
        const barHeight = maxCount === 0 ? 0 : (count / maxCount) * H;
        return (
          <rect key={i} x={i * barWidth} y={H - barHeight} width={barWidth - 1} height={barHeight} fill="black" />
        );
      })}
    </svg>
  );
}
