import { Tile } from "./Tile";
import { Button } from "./Button";
import { useStore } from "../store/store";

export function Dashboard() {
  const pinned = useStore((state: any) => state.pinned) as string[];
  const unpin = useStore((state: any) => state.tiles_unpin);
  if (pinned.length === 0) return null;
  return (
    <div>
      {pinned.map((path) => (
        <div key={path}>
          <Button label="unpin" onClick={() => unpin(path)} />
          <Tile path={path} />
        </div>
      ))}
    </div>
  );
}
