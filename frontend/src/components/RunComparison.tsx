import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRunComparison } from "../api/client";
import { loadFsm } from "../fsm/loadFsm";
import { selection_rows } from "../store/selectors/tableSelectors";
import { useStore } from "../store/store";
import { CellType, Table } from "../types/domain";
import { Button } from "./Button";
import { TableView } from "./TableView";

export function RunComparison({ path }: { path: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const source = useStore((state: any) => state.tables.get(path)) as Table | undefined;
  const focused = useStore((state: any) => state.focused);
  const loadTable = useStore((state: any) => state.tables_loadTable);
  const clearSelection = useStore((state: any) => state.focus_setTarget);
  const requested = useRef(0);
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const selectedRuns = source && focused?.tableId === path
    ? selection_rows(source, focused).flatMap((row) => {
        const cell = source.cells[row]?.find((value) => value.type === CellType.TableRef);
        return cell?.ref ? [cell.ref] : [];
      })
    : [];
  const comparedRuns = (searchParams.get("compare") ?? "").split(",").filter(Boolean);
  const comparisonId = comparedRuns.length >= 2 ? `compare:${comparedRuns.join("|")}` : "";
  const comparison = useStore((state: any) => state.tables.get(comparisonId)) as Table | undefined;

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
      .catch(() => {
        if (requested.current === request) {
          setLoadState((state) => loadFsm.next(state, "failure"));
        }
      });
  }, [comparisonId, comparison]);

  if (selectedRuns.length === 0 && comparedRuns.length < 2) return null;

  const setComparedRuns = (runs: string[]) => {
    const next = new URLSearchParams(searchParams);
    runs.length ? next.set("compare", runs.join(",")) : next.delete("compare");
    setSearchParams(next);
  };

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
            clearSelection(null);
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
      {loadState === "error" && <div className="table-filter-error">Run comparison failed</div>}
    </>
  );
}
