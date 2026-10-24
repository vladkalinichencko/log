import { useRef } from "react";
import { Table, CellType } from "../types/domain";
import { useStore } from "../store/store";
import { Tile } from "./Tile";
import { TileFrame } from "./TileFrame";

const NEIGHBOR_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

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
      {ordered.map((ref, index) => (
        <TileFrame
          key={ref}
          path={ref}
          tabIndex={0}
          aria-label={`${ref}: Alt+arrow moves the tile`}
          onKeyDown={(event) => {
            const neighbor = ordered[index + NEIGHBOR_STEPS[event.key]];
            if (!event.altKey || event.target !== event.currentTarget || !neighbor) return;
            event.preventDefault();
            reorder(parent, ordered, ref, neighbor);
          }}
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
