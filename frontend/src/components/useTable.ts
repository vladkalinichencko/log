import { useEffect, useRef, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { table_selector } from "../store/selectors/tableSelectors";
import { fetchTable } from "../api/client";

export function useTable(path: string) {
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const loadTable = useStore((state) => state.tables_loadTable);
  const loadView = useStore((state) => state.tables_loadView);
  const table = useStore((state) => table_selector(state, path));
  const savedView = useStore((state) => state.views.get(path));
  const liveTick = useStore((state) => state.liveTick);
  const hydratedView = useRef<string | null>(null);

  useEffect(() => {
    setLoadState(loadFsm.next(loadFsm.initial, "fetch"));
    if (savedView) {
      if (hydratedView.current !== path) {
        loadView(path, savedView);
        hydratedView.current = path;
      }
      setLoadState((s) => loadFsm.next(s, "success"));
      return;
    }
    hydratedView.current = null;
    let stale = false;
    fetchTable(path)
      .then((loaded) => {
        if (stale) return;
        loadTable(path, loaded);
        setLoadState((s) => loadFsm.next(s, "success"));
      })
      .catch((failure: Error) => {
        if (stale) return;
        setError(failure.message);
        setLoadState((s) => loadFsm.next(s, "failure"));
      });
    return () => {
      stale = true;
    };
  }, [path, liveTick, savedView, attempt]);

  return { table, loadState, error, retry: () => setAttempt((count) => count + 1) };
}
