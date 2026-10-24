import { useRef } from "react";
import { Table, CellType } from "../types/domain";
import { useStore } from "../store/store";
import { Tile } from "./Tile";
import { TileFrame } from "./TileFrame";

export function InlineView({ table }: { table: Table }) {
  const order = useStore((state) => state.order);
  const reorder = useStore((state) => state.tiles_reorder);
  const dragged = useRef<string | null>(null);
  const parent = table.source_path ?? "";
  const refs = table.cells
    .map((row) => row.find((cell) => cell.type === CellType.TableRef)?.ref)
    .filter((ref): ref is string => Boolean(ref));
  const saved = order.get(parent) ?? [];
  const ordered = [
    ...saved.filter((ref) => refs.includes(ref)),
    ...refs.filter((ref) => !saved.includes(ref)),
  ];
  return (
    <div className="tile-grid">
      {ordered.map((ref) => (
        <TileFrame
          key={ref}
          path={ref}
          draggable
          onDragStart={() => {
            dragged.current = ref;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragged.current && dragged.current !== ref) reorder(parent, ordered, dragged.current, ref);
            dragged.current = null;
          }}
        >
          <Tile path={ref} titled />
        </TileFrame>
      ))}
    </div>
  );
}
