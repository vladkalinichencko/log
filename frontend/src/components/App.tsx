import { NavBar } from "./NavBar";
import { Tile } from "./Tile";
import { Dashboard } from "./Dashboard";
import { Button } from "./Button";
import { useStore } from "../store/store";

export function App() {
  const currentPath = useStore((state: any) => state.currentPath);
  const pin = useStore((state: any) => state.tiles_pin);
  return (
    <div>
      <NavBar />
      <Button label="pin" onClick={() => pin(currentPath)} />
      <Tile path={currentPath} />
      <Dashboard />
    </div>
  );
}
