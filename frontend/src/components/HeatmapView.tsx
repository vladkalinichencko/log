import { Table } from "../types/domain";

interface HeatmapViewProps {
  table: Table;
}

const S = 20;

export function HeatmapView({ table }: HeatmapViewProps) {
  const rows = table.cells;
  if (rows.length === 0 || rows[0].length === 0) return <div>{table.name}</div>;

  const values = rows.flat().map((cell) => Number(cell.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const shade = (v: number) => {
    const norm = max === min ? 0.5 : (v - min) / (max - min);
    const g = Math.round(255 * (1 - norm));
    return `rgb(${g},${g},${g})`;
  };

  return (
    <svg width={rows[0].length * S} height={rows.length * S}>
      {rows.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * S}
            y={r * S}
            width={S}
            height={S}
            fill={shade(Number(cell.value))}
          />
        ))
      )}
    </svg>
  );
}
