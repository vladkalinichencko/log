import { useEffect, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { table_selector } from "../store/selectors/tableSelectors";
import { Table } from "../types/domain";

export function useLoadedTable(id: string | null, load: () => Promise<Table>) {
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const loadTable = useStore((state) => state.tables_loadTable);
  const table = useStore((state) => (id ? table_selector(state, id) : undefined));
  const liveTick = useStore((state) => state.liveTick);

  useEffect(() => {
    if (!id) return;
    let stale = false;
    setLoadState((s) => loadFsm.next(s, "fetch"));
    load()
      .then((loaded) => {
        if (stale) return;
        loadTable(id, { ...loaded, source_path: id });
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
  }, [id, liveTick, attempt]);

  return { table, loadState, error, retry: () => setAttempt((count) => count + 1) };
}
