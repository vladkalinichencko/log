import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRunComparison } from "../api/client";
import { loadFsm } from "../fsm/loadFsm";
import { selection_run_refs, table_selection_selector, table_selector } from "../store/selectors/tableSelectors";
import { with_param } from "../store/selectors/pathSelectors";
import { useStore } from "../store/store";
import { Button } from "./Button";
import { LoadError } from "./LoadError";
import { TableView } from "./TableView";

export function RunComparison({ path }: { path: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const source = useStore((state) => table_selector(state, path));
  const selection = useStore((state) => table_selection_selector(state, path));
  const loadTable = useStore((state) => state.tables_loadTable);
  const clearSelection = useStore((state) => state.focus_clear);
  const requested = useRef(0);
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const selectedRuns = source && selection ? selection_run_refs(source, selection) : [];
  const comparedRuns = (searchParams.get("compare") ?? "").split(",").filter(Boolean);
  const comparisonId = comparedRuns.length >= 2 ? `compare:${comparedRuns.join("|")}` : "";
  const comparison = useStore((state) => table_selector(state, comparisonId));

  useEffect(() => {
    if (!comparisonId || comparison) return;
    const request = ++requested.current;
    setLoadState((state) => loadFsm.next(state, "fetch"));
    fetchRunComparison(comparedRuns)
      .then((table) => {
        if (requested.current !== request) return;
        loadTable(comparisonId, { ...table, source_path: comparisonId });
        setLoadState((state) => loadFsm.next(state, "success"));
      })
      .catch((failure: Error) => {
        if (requested.current !== request) return;
        setError(failure.message);
        setLoadState((state) => loadFsm.next(state, "failure"));
      });
  }, [comparisonId, comparison, attempt]);

  if (selectedRuns.length === 0 && comparedRuns.length < 2) return null;

  const setComparedRuns = (runs: string[]) =>
    setSearchParams(with_param(searchParams, "compare", runs.join(",") || null));

  return (
    <>
      <div className="comparison-bar">
        <span>{selectedRuns.length || comparedRuns.length} runs</span>
        <Button
          label="Compare"
          disabled={selectedRuns.length < 2}
          onClick={() => setComparedRuns(selectedRuns)}
        />
        <Button
          label="Clear"
          onClick={() => {
            clearSelection();
            setComparedRuns([]);
          }}
        />
      </div>
      {comparison && (
        <section className="comparison-panel">
          <div className="section-heading">
            <h2>Run comparison</h2>
            <span className="subtitle">{comparison.cells.length}</span>
          </div>
          <TableView table={comparison} />
        </section>
      )}
      {loadState === "error" && <LoadError message={error} retry={() => setAttempt((count) => count + 1)} />}
    </>
  );
}
