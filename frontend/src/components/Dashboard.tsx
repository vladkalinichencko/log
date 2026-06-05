import { Tile } from "./Tile";
import { Button } from "./Button";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store/store";

export function Dashboard() {
  const pinned = useStore((state: any) => state.pinned) as string[];
  const tiles = useStore((state: any) => state.tiles);
  const unpin = useStore((state: any) => state.tiles_unpin);
  const resize = useStore((state: any) => state.tiles_resize);
  if (pinned.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {pinned.map((path) => {
        const tile = tiles.get(path);
        return (
          <div
            key={path}
            className="tile"
            style={{ width: tile?.w ?? 400, height: tile?.h ?? 300 }}
          >
            <Button icon="pin" ghost title="unpin" onClick={() => unpin(path)} />
            <Tile path={path} />
            <ResizeHandle onResize={(dw, dh) => resize(path, dw, dh)} />
          </div>
        );
      })}
    </div>
  );
}
