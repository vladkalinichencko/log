import { useTable } from "./useTable";
import { render } from "./render";
import { LoadError } from "./LoadError";
import { RunOverview } from "./RunOverview";
import { CellType, Representation } from "../types/domain";
import { path_segments } from "../store/selectors/pathSelectors";

interface MainViewProps {
  path: string;
}

export function MainView({ path }: MainViewProps) {
  const { table, loadState, error, retry } = useTable(path);

  if (loadState === "error") return <LoadError message={error} retry={retry} />;
  if (!table) return <div>Loading…</div>;

  const depth = path_segments(path).length;
  const hasChildren = table.cells.some((row) =>
    row.some((cell) => cell.type === CellType.TableRef)
  );
  const inline = depth >= 2 && hasChildren;
  const sectionTitle = depth === 0 ? "All projects" : depth === 1 ? "Runs" : inline ? "Tables" : "Data";

  const runOverview = depth === 2 && table.cells.some((row) => row[0]?.ref === `${path}.metrics`);
  const shown = runOverview ? { ...table, cells: table.cells.filter((row) => row[0]?.ref !== `${path}.metrics`) } : table;

  return (
    <>
      {runOverview && <RunOverview path={path} />}
      <section className="data-section">
        <div className="section-heading">
          <h2>{sectionTitle}</h2>
          <span className="subtitle">{shown.cells.length}</span>
        </div>
        {render(shown, inline ? Representation.Inline : Representation.Grid)}
      </section>
    </>
  );
}
