import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { NavBar } from "./NavBar";
import { Tile } from "./Tile";
import { Dashboard } from "./Dashboard";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useStore } from "../store/store";
import { fetchWorkspaces, fetchViews, fetchFunctions, saveWorkspace } from "../api/client";
import { connectWebSocket } from "../api/websocket";

export function App() {
  const currentPath = decodeURIComponent(useLocation().pathname.slice(1));
  const pin = useStore((state: any) => state.tiles_pin);
  const pinned = useStore((state: any) => state.pinned) as string[];
  const tiles = useStore((state: any) => state.tiles);
  const loadWorkspace = useStore((state: any) => state.tiles_loadWorkspace);
  const setViews = useStore((state: any) => state.tables_setViews);
  const setFunctions = useStore((state: any) => state.tables_setFunctions);
  const liveBump = useStore((state: any) => state.live_bump);
  const connectionEvent = useStore((state: any) => state.connection_event);
  const undo = useStore((state: any) => state.tables_undo);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    fetchWorkspaces()
      .then((list) => {
        if (list.length) loadWorkspace(list[0]);
      })
      .catch((err) => console.error("Failed to load workspaces:", err));
    fetchViews()
      .then(setViews)
      .catch((err) => console.error("Failed to load views:", err));
    fetchFunctions()
      .then(setFunctions)
      .catch((err) => console.error("Failed to load functions:", err));
  }, []);

  useEffect(() => {
    let socket: WebSocket;
    let retryDelay = 1000;
    let retryTimer = 0;
    let unmounted = false;
    const connect = () => {
      socket = connectWebSocket((msg) => {
        if (msg.type === "run_updated") liveBump();
      });
      socket.onopen = () => {
        retryDelay = 1000;
        connectionEvent("open");
      };
      socket.onclose = () => {
        if (unmounted) return;
        connectionEvent("close");
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
    };
    connect();
    return () => {
      unmounted = true;
      window.clearTimeout(retryTimer);
      socket.close();
    };
  }, []);

  const save = () =>
    saveWorkspace("default", {
      id: "default",
      tiles: pinned.map((path) => ({
        id: path,
        table_path: path,
        mode: tiles.get(path)?.mode ?? "table",
        representation: tiles.get(path)?.representation,
        w: tiles.get(path)?.w,
        h: tiles.get(path)?.h,
      })),
    }).catch((err) => console.error("Failed to save workspace:", err));

  return (
    <div>
      <div className="bar">
        <NavBar />
        <div className="group">
          <Button icon="pin" ghost title="pin to dashboard" onClick={() => pin(currentPath)} />
          <Button icon="save" ghost title="save workspace" onClick={save} />
        </div>
      </div>
      <div className="content">
        <Tile path={currentPath} />
        <Dashboard />
      </div>
      <Modal />
    </div>
  );
}
