import { NavBar } from "./NavBar";
import { Tile } from "./Tile";
import { useStore } from "../store/store";

export function App() {
  const currentPath = useStore((state: any) => state.currentPath);
  return (
    <div>
      <NavBar />
      <Tile path={currentPath} />
    </div>
  );
}
