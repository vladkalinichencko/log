import { useEffect } from "react";
import { NavBar } from "./NavBar";
import { Tile } from "./Tile";
import { Dashboard } from "./Dashboard";
import { Button } from "./Button";
import { useStore } from "../store/store";
import { fetchWorkspaces, saveWorkspace } from "../api/client";

export function App() {
  const currentPath = useStore((state: any) => state.currentPath);
  const pin = useStore((state: any) => state.tiles_pin);
  const pinned = useStore((state: any) => state.pinned) as string[];
  const tiles = useStore((state: any) => state.tiles);
  const loadWorkspace = useStore((state: any) => state.tiles_loadWorkspace);

  useEffect(() => {
    fetchWorkspaces()
      .then((list) => {
        if (list.length) loadWorkspace(list[0]);
      })
      .catch((err) => console.error("Failed to load workspaces:", err));
  }, []);

  const save = () =>
    saveWorkspace("default", {
      id: "default",
      tiles: pinned.map((path) => ({
        table_path: path,
        mode: "table",
        representation: tiles.get(path)?.representation,
      })),
    }).catch((err) => console.error("Failed to save workspace:", err));

  return (
    <div>
      <NavBar />
      <Button label="pin" onClick={() => pin(currentPath)} />
      <Button label="save" onClick={save} />
      <Tile path={currentPath} />
      <Dashboard />
    </div>
  );
}
