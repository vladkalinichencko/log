import { useTable } from "./useTable";
import { render } from "./render";
import { CellType, Representation } from "../types/domain";

interface MainViewProps {
  path: string;
}

export function MainView({ path }: MainViewProps) {
  const { table, loadState } = useTable(path);

  if (loadState === "error") return <div>Failed to load {path}</div>;
  if (!table) return <div>Loading…</div>;

  const depth = path ? path.split(".").length : 0;
  const hasChildren = table.cells.some((row) =>
    row.some((cell) => cell.type === CellType.TableRef)
  );
  const inline = depth >= 2 && hasChildren;
  const sectionTitle = depth === 0 ? "All projects" : depth === 1 ? "Runs" : inline ? "Tables" : "Data";

  return (
    <section className="data-section">
      <div className="section-heading">
        <h2>{sectionTitle}</h2>
        <span className="subtitle">{table.cells.length}</span>
      </div>
      {render(table, inline ? Representation.Inline : Representation.Grid)}
    </section>
  );
}
