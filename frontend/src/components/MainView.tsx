import { Tile } from "./Tile";
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

  const hasChildren = table.cells.some((row) => row.some((cell) => cell.type === CellType.TableRef));
  return hasChildren ? render(table, Representation.Inline) : <Tile path={path} />;
}
