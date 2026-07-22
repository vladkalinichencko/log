import { useRef } from "react";
import { Table, CellType } from "../types/domain";
import { useStore } from "../store/store";
import { Tile } from "./Tile";
import { ResizeHandle } from "./ResizeHandle";
import { snapWidth } from "../store/slices/tilesSlice";

export function InlineView({ table }: { table: Table }) {
  const tiles = useStore((state: any) => state.tiles);
  const order = useStore((state: any) => state.order);
  const setSize = useStore((state: any) => state.tiles_setSize);
  const resize = useStore((state: any) => state.tiles_resize);
  const reorder = useStore((state: any) => state.tiles_reorder);
  const dragged = useRef<string | null>(null);
  const parent = table.source_path ?? "";
  const refs = table.cells
    .map((row) => row.find((cell) => cell.type === CellType.TableRef)?.ref)
    .filter((ref): ref is string => Boolean(ref));
  const saved: string[] = order.get(parent) ?? [];
  const ordered = [
    ...saved.filter((ref) => refs.includes(ref)),
    ...refs.filter((ref) => !saved.includes(ref)),
  ];
  return (
    <div className="tile-grid">
      {ordered.map((ref) => {
          const tile = tiles.get(ref);
          const width = tile?.w ?? 320;
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
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragged.current && dragged.current !== ref) {
                  reorder(parent, ordered, dragged.current, ref);
                }
                dragged.current = null;
              }}
            >
              <Tile path={ref} titled />
              <ResizeHandle
                onResize={(dw, dh) => resize(ref, dw, dh)}
                onResizeEnd={(dw, dh) =>
                  setSize(ref, snapWidth(width + dw, window.innerWidth - 24), height + dh)
                }
              />
            </div>
          );
        })}
    </div>
  );
}
