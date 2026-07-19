import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavBar } from "./NavBar";
import { MainView } from "./MainView";
import { Dashboard } from "./Dashboard";
import { Modal } from "./Modal";
import { Settings } from "./Settings";
import { Button } from "./Button";
import { useStore } from "../store/store";
import { fetchWorkspaces, fetchViews, fetchFunctions, saveWorkspace, saveView } from "../api/client";
import { connectWebSocket } from "../api/websocket";

export function App() {
  const navigate = useNavigate();
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
  const redo = useStore((state: any) => state.tables_redo);
  const theme = useStore((state: any) => state.theme);

  const accent = useStore((state: any) => state.accent);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--accent", accent);
  }, [theme, accent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && key === "z") {
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    }, 500);
    return () => window.clearTimeout(timer);
  }, [pinned, tiles]);

  useEffect(() => {
    let timer = 0;
    const unsubscribe = (useStore as any).subscribe((state: any, prev: any) => {
      if (state.editHistory === prev.editHistory && state.editFuture === prev.editFuture) return;
      const edited =
        state.editHistory[state.editHistory.length - 1] ??
        state.editFuture[state.editFuture.length - 1];
      if (!edited) return;
      const table = state.tables.get(edited.tableId);
      if (!table) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveView(edited.tableId, { id: edited.tableId, ...table, source_path: edited.tableId })
          .then(() => fetchViews().then(setViews))
          .catch((err) => console.error("Failed to save view:", err));
      }, 500);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const heroTitle = currentPath.split(".").filter(Boolean).pop() ?? "Projects";

  return (
    <div>
      <div className="bar">
        <NavBar />
        <div className="group">
          <Button icon="pin" ghost title="pin to dashboard" onClick={() => pin(currentPath)} />
          <Button icon="gear" ghost title="settings" onClick={() => navigate("/settings")} />
        </div>
      </div>
      <div className="content">
        {currentPath === "settings" ? (
          <Settings />
        ) : (
          <>
            <h1>{heroTitle}</h1>
            <MainView path={currentPath} />
            <Dashboard />
          </>
        )}
      </div>
      <Modal />
    </div>
  );
}
