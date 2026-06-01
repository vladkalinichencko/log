import { Table } from "../types/domain";

interface LineChartViewProps {
  table: Table;
}

const W = 600;
const H = 200;

export function LineChartView({ table }: LineChartViewProps) {
  const cols = table.column_names;
  if (!cols || table.cells.length === 0) return <div>{table.name}</div>;

  const xi = Math.max(0, cols.indexOf("step"));
  const yi = cols.length - 1;
  const xs = table.cells.map((row) => Number(row[xi].value));
  const ys = table.cells.map((row) => Number(row[yi].value));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (v: number) => (maxX === minX ? 0 : ((v - minX) / (maxX - minX)) * W);
  const sy = (v: number) => (maxY === minY ? H / 2 : H - ((v - minY) / (maxY - minY)) * H);
  const points = xs.map((x, i) => `${sx(x)},${sy(ys[i])}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline points={points} fill="none" stroke="black" />
    </svg>
  );
}
