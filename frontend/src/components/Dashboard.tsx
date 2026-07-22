import { Tile } from "./Tile";
import { Button } from "./Button";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store/store";
import { snapWidth } from "../store/slices/tilesSlice";

export function Dashboard() {
  const pinned = useStore((state: any) => state.pinned) as string[];
  const tiles = useStore((state: any) => state.tiles);
  const unpin = useStore((state: any) => state.tiles_unpin);
  const resize = useStore((state: any) => state.tiles_resize);
  const setSize = useStore((state: any) => state.tiles_setSize);
  if (pinned.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {pinned.map((path) => {
        const tile = tiles.get(path);
        const width = tile?.w ?? 400;
        const height = tile?.h ?? 300;
        return (
          <div
            key={path}
            className="tile"
            style={{ width, height }}
          >
            <div className="bar">
              <span />
              <Button icon="pin" ghost title="unpin" onClick={() => unpin(path)} />
            </div>
            <Tile path={path} />
            <ResizeHandle
              onResize={(dw, dh) => resize(path, dw, dh)}
              onResizeEnd={(dw, dh) =>
                setSize(path, snapWidth(width + dw, window.innerWidth - 24), height + dh)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
