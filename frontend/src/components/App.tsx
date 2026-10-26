import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NavBar } from "./NavBar";
import { MainView } from "./MainView";
import { Dashboard } from "./Dashboard";
import { Modal } from "./Modal";
import { RunComparison } from "./RunComparison";
import { Button } from "./Button";
import { useTheme } from "./Settings";
import { useCurrentPath } from "./useCurrentPath";
import { useStore } from "../store/store";
import { path_segments, with_param } from "../store/selectors/pathSelectors";
import { fetchWorkspaces, fetchViews, fetchFunctions, fetchPaths, saveWorkspace, saveView } from "../api/client";
import { Notices, attempt } from "./Notices";
import { connectWebSocket } from "../api/websocket";
import { Table } from "../types/domain";

export function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = useCurrentPath();
  const pin = useStore((state) => state.tiles_pin);
  useTheme();
  useUndoKeys();
  useCatalogs();
  useLiveUpdates();
  useWorkspaceAutosave();
  useViewAutosave();

  return (
    <div>
      <div className="bar">
        <NavBar />
        <div className="group">
          <Button icon="pin" ghost title="pin to dashboard" onClick={() => pin(currentPath)} />
          <Button icon="gear" ghost title="settings" onClick={() => setSearchParams(with_param(searchParams, "settings", "1"))} />
        </div>
      </div>
      <div className="content">
        <h1>{path_segments(currentPath).pop() ?? "Projects"}</h1>
        <MainView path={currentPath} />
        <RunComparison path={currentPath} />
        <Dashboard />
      </div>
      <Modal />
      <Notices />
    </div>
  );
}

function useUndoKeys() {
  const undo = useStore((state) => state.tables_undo);
  const redo = useStore((state) => state.tables_redo);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || !(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function useCatalogs() {
  const loadWorkspace = useStore((state) => state.tiles_loadWorkspace);
  const setViews = useStore((state) => state.tables_setViews);
  const setFunctions = useStore((state) => state.tables_setFunctions);
  useEffect(() => {
    attempt("workspace", () => fetchWorkspaces().then((list) => list[0] && loadWorkspace(list[0])));
    attempt("saved views", () => fetchViews().then(setViews));
    attempt("table functions", () => fetchFunctions().then(setFunctions));
    loadPaths();
  }, []);
}

const loadPaths = () => attempt("table paths", () => fetchPaths().then(useStore.getState().search_setPaths));

function useLiveUpdates() {
  const bump = useStore((state) => state.connection_bump);
  const connectionEvent = useStore((state) => state.connection_event);
  const notify = useStore((state) => state.notices_push);
  const navigate = useNavigate();
  useEffect(() => {
    let socket: WebSocket;
    let retryDelay = 1000;
    let retryTimer = 0;
    let unmounted = false;
    const connect = () => {
      socket = connectWebSocket((message) => {
        if (message.type === "run_updated") bump();
        if (message.type === "run_added" || message.type === "run_removed") {
          bump();
          loadPaths();
        }
        if (message.type === "alert") {
          const run = message.run.replace("/", ".");
          notify(`${run}: ${message.path} ${message.message} at step ${message.step}`, { label: "Open", perform: () => navigate(`/${run}`) });
        }
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
}

function useWorkspaceAutosave() {
  const pinned = useStore((state) => state.pinned);
  const tiles = useStore((state) => state.tiles);
  useEffect(() => {
    const workspace = {
      id: "default",
      tiles: pinned.map((path) => ({
        id: path,
        table_path: path,
        mode: tiles.get(path)?.mode ?? "table",
        representation: tiles.get(path)?.representation,
        w: tiles.get(path)?.w,
        h: tiles.get(path)?.h,
      })),
    };
    const timer = window.setTimeout(() => attempt("saving the dashboard", () => saveWorkspace(workspace)), 500);
    return () => window.clearTimeout(timer);
  }, [pinned, tiles]);
}

function useViewAutosave() {
  const setViews = useStore((state) => state.tables_setViews);
  useEffect(() => {
    let timer = 0;
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.editHistory === prev.editHistory && state.editFuture === prev.editFuture) return;
      const edited = state.editHistory[state.editHistory.length - 1] ?? state.editFuture[state.editFuture.length - 1];
      const table = edited && state.tables.get(edited.tableId);
      if (!table) return;
      const snapshots = (edits: { tableId: string; table: Table }[]) =>
        edits.filter((edit) => edit.tableId === edited.tableId).slice(-20).map((edit) => edit.table);
      const view = {
        ...table,
        id: edited.tableId,
        source_path: edited.tableId,
        history: snapshots(state.editHistory),
        future: snapshots(state.editFuture),
      };
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => attempt(`saving ${view.id}`, () => saveView(view).then(fetchViews).then(setViews)),
        500
      );
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);
}
