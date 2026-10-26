import { useSearchParams } from "react-router-dom";
import { evalTable, fetchRunComparison } from "../api/client";
import { selection_run_refs, table_selection_selector, table_selector } from "../store/selectors/tableSelectors";
import { path_segments, with_param } from "../store/selectors/pathSelectors";
import { hero_metric_selector, metric_names } from "../store/selectors/runSelectors";
import { useStore } from "../store/store";
import { Representation } from "../types/domain";
import { Chart } from "../modules/chart";
import { Button } from "./Button";
import { LoadError } from "./LoadError";
import { Menu } from "./Menu";
import { MenuButton } from "./MenuButton";
import { Placeholder } from "./Placeholder";
import { TableView } from "./TableView";
import { useLoadedTable } from "./useLoadedTable";
import { useProjectSettings } from "./useProjectSettings";
import { useTable } from "./useTable";

export function RunComparison({ path }: { path: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const source = useStore((state) => table_selector(state, path));
  const selection = useStore((state) => table_selection_selector(state, path));
  const clearSelection = useStore((state) => state.focus_clear);
  const selectedRuns = source && selection ? selection_run_refs(source, selection) : [];
  const comparedRuns = (searchParams.get("compare") ?? "").split(",").filter(Boolean);
  const compared = comparedRuns.length >= 2;
  const comparison = useLoadedTable(compared ? `compare:${comparedRuns.join("|")}` : null, () => fetchRunComparison(comparedRuns));

  if (selectedRuns.length === 0 && !compared) return null;

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
      {compared && <RunOverlay runs={comparedRuns} />}
      {comparison.table && (
        <section className="comparison-panel">
          <div className="section-heading">
            <h2>Run comparison</h2>
            <span className="subtitle">{comparison.table.cells.length}</span>
          </div>
          <TableView table={comparison.table} />
        </section>
      )}
      {comparison.loadState === "error" && <LoadError message={comparison.error} retry={comparison.retry} />}
    </>
  );
}

function RunOverlay({ runs }: { runs: string[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const first = useTable(`${runs[0]}.metrics`);
  const { settings } = useProjectSettings(path_segments(runs[0])[0]);
  const metric = first.table && hero_metric_selector(first.table, searchParams.get("overlay") ?? settings?.hero);
  const expression = metric ? `overlay(${metric}, ${runs.join(", ")})` : null;
  const overlay = useLoadedTable(expression, () => evalTable(expression!));

  return (
    <section className="comparison-panel">
      <div className="section-heading">
        <h2>Overlay</h2>
        {first.table && metric && (
          <MenuButton label={`${metric} ▾`} ghost title="Metric drawn for every compared run">
            {(close) => (
              <Menu
                items={metric_names(first.table!).map((name) => ({
                  label: name,
                  onPick: () => {
                    setSearchParams(with_param(searchParams, "overlay", name));
                    close();
                  },
                }))}
              />
            )}
          </MenuButton>
        )}
        <span className="subtitle">{expression ?? " "}</span>
      </div>
      {overlay.loadState === "error" ? (
        <LoadError message={overlay.error} retry={overlay.retry} />
      ) : (
        <div className="run-hero">
          {overlay.table ? <Chart table={overlay.table} representation={Representation.Line} /> : <Placeholder label="loading" />}
        </div>
      )}
    </section>
  );
}
