import { Tile } from "./Tile";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store/store";
import { useTable } from "./useTable";
import { Cell, CellType } from "../types/domain";

interface MainViewProps {
  path: string;
}

export function MainView({ path }: MainViewProps) {
  const { table, loadState } = useTable(path);
  const tiles = useStore((state: any) => state.tiles);
  const resize = useStore((state: any) => state.tiles_resize);

  if (loadState === "error") return <div>Failed to load {path}</div>;
  if (!table) return <div>Loading…</div>;

  const children: string[] = table.cells
    .map((row: Cell[]) => row.find((cell: Cell) => cell.type === CellType.TableRef)?.ref)
    .filter((ref: string | null | undefined): ref is string => Boolean(ref));

  if (children.length === 0) return <Tile path={path} />;

  return (
    <div className="tile-grid">
      {children.map((ref: string) => {
        const tile = tiles.get(ref);
        return (
          <div key={ref} className="tile" style={{ width: tile?.w ?? 400, height: tile?.h ?? 300 }}>
            <Tile path={ref} titled />
            <ResizeHandle onResize={(dw, dh) => resize(ref, dw, dh)} />
          </div>
        );
      })}
    </div>
  );
}
