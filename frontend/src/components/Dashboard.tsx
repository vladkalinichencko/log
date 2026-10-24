import { Tile } from "./Tile";
import { TileFrame } from "./TileFrame";
import { Button } from "./Button";
import { useStore } from "../store/store";

export function Dashboard() {
  const pinned = useStore((state) => state.pinned);
  const unpin = useStore((state) => state.tiles_unpin);
  if (pinned.length === 0) return null;
  return (
    <div className="tile-grid">
      {pinned.map((path) => (
        <TileFrame key={path} path={path}>
          <div className="bar">
            <span />
            <Button icon="pin" ghost title="unpin" onClick={() => unpin(path)} />
          </div>
          <Tile path={path} />
        </TileFrame>
      ))}
    </div>
  );
}
