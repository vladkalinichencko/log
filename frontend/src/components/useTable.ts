import { useEffect, useRef, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { fetchTable } from "../api/client";
import { Table } from "../types/domain";

export function useTable(path: string): { table: Table | undefined; loadState: string } {
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const loadTable = useStore((state: any) => state.tables_loadTable);
  const loadView = useStore((state: any) => state.tables_loadView);
  const table = useStore((state: any) => state.tables.get(path));
  const savedView = useStore((state: any) => state.views.get(path));
  const liveTick = useStore((state: any) => state.liveTick);
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
      .catch(() => {
        if (stale) return;
        setLoadState((s) => loadFsm.next(s, "failure"));
      });
    return () => {
      stale = true;
    };
  }, [path, liveTick, savedView]);

  return { table, loadState };
}
