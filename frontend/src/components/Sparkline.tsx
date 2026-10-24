export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((value, i) => `${(i / (values.length - 1)) * 100},${24 - ((value - low) / span) * 24}`);
  return (
    <svg className="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.join(" ")} />
    </svg>
  );
}
