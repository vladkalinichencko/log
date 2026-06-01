import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { NavBar } from "./NavBar";
import { Tile } from "./Tile";
import { Dashboard } from "./Dashboard";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useStore } from "../store/store";
import { fetchWorkspaces, saveWorkspace } from "../api/client";
import { connectWebSocket } from "../api/websocket";

export function App() {
  const currentPath = decodeURIComponent(useLocation().pathname.slice(1));
  const pin = useStore((state: any) => state.tiles_pin);
  const pinned = useStore((state: any) => state.pinned) as string[];
  const tiles = useStore((state: any) => state.tiles);
  const loadWorkspace = useStore((state: any) => state.tiles_loadWorkspace);
  const liveBump = useStore((state: any) => state.live_bump);
  const connectionEvent = useStore((state: any) => state.connection_event);

  useEffect(() => {
    fetchWorkspaces()
      .then((list) => {
        if (list.length) loadWorkspace(list[0]);
      })
      .catch((err) => console.error("Failed to load workspaces:", err));
  }, []);

  useEffect(() => {
    const socket = connectWebSocket((msg) => {
      if (msg.type === "run_updated") liveBump();
    });
    socket.onopen = () => connectionEvent("open");
    socket.onclose = () => connectionEvent("close");
    return () => socket.close();
  }, []);

  const save = () =>
    saveWorkspace("default", {
      id: "default",
      tiles: pinned.map((path) => ({
        table_path: path,
        mode: "table",
        representation: tiles.get(path)?.representation,
        w: tiles.get(path)?.w,
        h: tiles.get(path)?.h,
      })),
    }).catch((err) => console.error("Failed to save workspace:", err));

  return (
    <div>
      <NavBar />
      <Button label="pin" onClick={() => pin(currentPath)} />
      <Button label="save" onClick={save} />
      <Tile path={currentPath} />
      <Dashboard />
      <Modal />
    </div>
  );
}
