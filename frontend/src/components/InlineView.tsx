import { Table, CellType } from "../types/domain";
import { useStore } from "../store/store";
import { Arrange } from "../modules/arrange";
import { Tile } from "./Tile";
import { TileFrame } from "./TileFrame";

export function InlineView({ table }: { table: Table }) {
  const order = useStore((state) => state.order);
  const reorder = useStore((state) => state.tiles_reorder);
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
    <Arrange keys={ordered} onMove={(moved, target) => reorder(parent, ordered, moved, target)} className="tile-grid">
      {ordered.map((ref) => (
        <TileFrame key={ref} path={ref} arranged>
          <Tile path={ref} titled />
        </TileFrame>
      ))}
    </Arrange>
  );
}
