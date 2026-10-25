export function Placeholder({ label }: { label: string }) {
  return (
    <div className="placeholder">
      <span className="subtitle">{label}</span>
    </div>
  );
}
