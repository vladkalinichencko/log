import { useRef } from "react";
import { Tile } from "./Tile";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store/store";
import { useTable } from "./useTable";
import { snapWidth } from "../store/slices/tilesSlice";
import { Cell, CellType } from "../types/domain";

interface MainViewProps {
  path: string;
}

export function MainView({ path }: MainViewProps) {
  const { table, loadState } = useTable(path);
  const tiles = useStore((state: any) => state.tiles);
  const order = useStore((state: any) => state.order);
  const setSize = useStore((state: any) => state.tiles_setSize);
  const reorder = useStore((state: any) => state.tiles_reorder);
  const dragged = useRef<string | null>(null);

  if (loadState === "error") return <div>Failed to load {path}</div>;
  if (!table) return <div>Loading…</div>;

  const refs: string[] = table.cells
    .map((row: Cell[]) => row.find((cell: Cell) => cell.type === CellType.TableRef)?.ref)
    .filter((ref: string | null | undefined): ref is string => Boolean(ref));

  if (refs.length === 0) return <Tile path={path} />;

  const saved: string[] = order.get(path) ?? [];
  const children = [
    ...saved.filter((ref: string) => refs.includes(ref)),
    ...refs.filter((ref: string) => !saved.includes(ref)),
  ];

  return (
    <div className="tile-grid">
      {children.map((ref: string) => {
        const tile = tiles.get(ref);
        const width = tile?.w ?? 400;
        const height = tile?.h ?? 300;
        return (
          <div
            key={ref}
            className="tile"
            style={{ width, height }}
            draggable
            onDragStart={() => {
              dragged.current = ref;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragged.current && dragged.current !== ref) {
                reorder(path, children, dragged.current, ref);
              }
              dragged.current = null;
            }}
          >
            <Tile path={ref} titled />
            <ResizeHandle
              onResize={(dw, dh) =>
                setSize(ref, snapWidth(width + dw, window.innerWidth - 24), height + dh)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
