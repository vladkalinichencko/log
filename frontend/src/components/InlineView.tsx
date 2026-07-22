import { useRef } from "react";
import { Table, Cell, CellType } from "../types/domain";
import { useStore } from "../store/store";
import { Tile } from "./Tile";
import { ResizeHandle } from "./ResizeHandle";
import { Cell as CellView } from "./Cell";
import { snapWidth } from "../store/slices/tilesSlice";

export function InlineView({ table }: { table: Table }) {
  const tiles = useStore((state: any) => state.tiles);
  const order = useStore((state: any) => state.order);
  const setSize = useStore((state: any) => state.tiles_setSize);
  const reorder = useStore((state: any) => state.tiles_reorder);
  const dragged = useRef<string | null>(null);
  const parent = table.source_path ?? "";
  const refs = table.cells
    .map((row: Cell[]) => row.find((cell: Cell) => cell.type === CellType.TableRef)?.ref)
    .filter((ref): ref is string => Boolean(ref));
  const saved: string[] = order.get(parent) ?? [];
  const ordered = [
    ...saved.filter((ref) => refs.includes(ref)),
    ...refs.filter((ref) => !saved.includes(ref)),
  ];
  const rows = ordered.map(
    (ref) => table.cells.find((row) => row.some((cell) => cell.ref === ref))!
  );

  return (
    <table className="inline-view">
      {table.column_names && (
        <thead>
          <tr>
            {table.column_names.map((name, column) => (
              <th key={column}><span className="cell">{name}</span></th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => {
          const ref = row.find((cell) => cell.type === CellType.TableRef)?.ref!;
          const tile = tiles.get(ref);
          const width = tile?.w ?? 400;
          const height = tile?.h ?? 300;
          return (
            <tr
              key={ref}
              draggable
              onDragStart={() => {
                dragged.current = ref;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragged.current && dragged.current !== ref) {
                  reorder(parent, refs, dragged.current, ref);
                }
                dragged.current = null;
              }}
            >
              {row.map((cell, c) => (
                <td key={c}>
                  {cell.ref === ref ? (
                    <div className="tile" style={{ width, height }}>
                      <Tile path={ref} titled />
                      <ResizeHandle
                        onResize={(dw, dh) =>
                          setSize(ref, snapWidth(width + dw, window.innerWidth - 24), height + dh)
                        }
                      />
                    </div>
                  ) : (
                    <CellView cell={cell} tableId={parent} rowIndex={r} colIndex={c} />
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
