import { useEffect, useState } from "react";
import { fetchTensorFrame, fetchTensorSteps } from "../api/client";
import { loadFsm } from "../fsm/loadFsm";
import { tensor_source } from "../store/selectors/pathSelectors";
import { useStore } from "../store/store";
import { Table, TableKind } from "../types/domain";

export function useTensor(path: string, table: Table | undefined) {
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const [attempt, setAttempt] = useState(0);
  const tensor = useStore((state) => state.tensors.get(path));
  const loadTensor = useStore((state) => state.tables_loadTensor);
  const notify = useStore((state) => state.notices_push);
  const liveTick = useStore((state) => state.liveTick);
  const source = table?.kind === TableKind.Grid ? tensor_source(path) : null;

  useEffect(() => {
    if (!source) return;
    let stale = false;
    setLoadState((state) => loadFsm.next(state, "fetch"));
    fetchTensorSteps(source.run, source.leaf)
      .then(async (steps) => ({
        steps,
        frames: await Promise.all(steps.map((step) => fetchTensorFrame(source.run, source.leaf, step))),
      }))
      .then((loaded) => {
        if (stale) return;
        loadTensor(path, loaded);
        setLoadState((state) => loadFsm.next(state, "success"));
      })
      .catch((error: Error) => {
        if (stale) return;
        setLoadState((state) => loadFsm.next(state, "failure"));
        notify(`frames of ${path}: ${error.message}`, { label: "Retry", perform: () => setAttempt((count) => count + 1) });
      });
    return () => {
      stale = true;
    };
  }, [path, source?.run, source?.leaf, liveTick, attempt]);

  return { tensor, leaf: source?.leaf ?? "", loadState };
}
