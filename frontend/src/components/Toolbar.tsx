import { RefObject, useEffect, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { evalTable, deleteRun, renameRuns, deleteView, fetchViews } from "../api/client";
import { exportCsv, exportJson } from "./exportTable";
import { Button } from "./Button";
import { Menu } from "./Menu";
import { MenuButton } from "./MenuButton";
import { RenamePanel } from "./RenamePanel";
import { attempt } from "./Notices";
import { Table, CellType, TableFunction } from "../types/domain";
import { SERIES } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";
import { formula_selector } from "../store/selectors/searchSelectors";
import { is_run_ref } from "../store/selectors/pathSelectors";
import { table_selection_selector } from "../store/selectors/tableSelectors";

export const COLUMN_PLACEHOLDER = "«col»";

export function functionExpression(fn: TableFunction, column: string): string {
  const args = fn.windowed ? `${column}, 20` : column;
  return `derive(${fn.name}_${column} = ${fn.name}(${args}))`;
}

async function exportPng(content: HTMLElement | null, filename: string) {
  const plot = content?.querySelector<HTMLElement>(".js-plotly-plot");
  if (!plot) throw new Error("this tile shows a table; switch it to a chart first");
  const Plotly = (await import("plotly.js/dist/plotly")).default;
  await Plotly.downloadImage(plot, { format: "png", width: 1600, height: 900, filename });
}

interface ToolbarProps {
  path: string;
  table: Table;
  content: RefObject<HTMLDivElement>;
}

export function Toolbar({ path, table, content }: ToolbarProps) {
  const replace = useStore((state) => state.tables_replace);
  const removeRow = useStore((state) => state.tables_removeRow);
  const removeColumn = useStore((state) => state.tables_removeColumn);
  const clearSelection = useStore((state) => state.focus_clear);
  const setAccent = useStore((state) => state.settings_setAccent);
  const setViews = useStore((state) => state.tables_setViews);
  const setPicking = useStore((state) => state.focus_setPicking);
  const pickColumn = useStore((state) => state.focus_pickColumn);
  const pickedColumn = useStore((state) => state.pickedColumn);
  const functions = useStore((state) => state.functions);
  const selection = useStore((state) => table_selection_selector(state, path));
  const paths = useStore((state) => state.paths);
  const savedView = useStore((state) => state.views.get(path));
  const [expr, setExpr] = useState("");
  const [evalState, setEvalState] = useState(loadFsm.initial);
  const [evalError, setEvalError] = useState("");

  useEffect(() => {
    setPicking(expr.includes(COLUMN_PLACEHOLDER));
    return () => setPicking(false);
  }, [expr]);

  useEffect(() => {
    if (!pickedColumn) return;
    if (expr.includes(COLUMN_PLACEHOLDER)) {
      const filled = expr.replace(COLUMN_PLACEHOLDER, pickedColumn);
      setExpr(filled);
      if (!filled.includes(COLUMN_PLACEHOLDER)) run(filled);
    }
    pickColumn(null);
  }, [pickedColumn]);

  const activeSelection = selection?.ranges[selection.ranges.length - 1] ?? null;
  const lineSelection = activeSelection && activeSelection.kind !== "cell" ? activeSelection : null;

  const runRef =
    lineSelection?.kind === "row"
      ? table.cells[lineSelection.r]?.find((cell) => cell.type === CellType.TableRef && is_run_ref(cell.ref))?.ref ?? null
      : null;

  const run = (expression: string) => {
    const full = expression.trim().startsWith("table(") ? expression : `table(${path}) | ${expression}`;
    setEvalState((s) => loadFsm.next(s, "fetch"));
    evalTable(full)
      .then((result) => {
        replace(path, result);
        setEvalState((s) => loadFsm.next(s, "success"));
      })
      .catch((error: Error) => {
        setEvalError(error.message);
        setEvalState((s) => loadFsm.next(s, "failure"));
      });
  };

  const deleteSelection = async () => {
    if (runRef) {
      const [project, name] = runRef.split(".");
      await deleteRun(project, name);
    } else if (lineSelection?.kind === "row") {
      removeRow(path, lineSelection.r);
    } else if (lineSelection?.kind === "col") {
      removeColumn(path, lineSelection.c);
    }
    clearSelection();
  };

  const renameSelection = async (fields: { prefix: string; suffix: string; find: string; replace: string }) => {
    if (!runRef) return;
    await renameRuns([runRef.replace(".", "/")], fields);
    clearSelection();
  };

  const selectedColumn =
    activeSelection && activeSelection.c >= 0 ? table.column_names?.[activeSelection.c] ?? null : null;

  const { word, suggestions } = formula_selector({ functions, paths }, expr, table.column_names ?? []);

  const catalogSections = (close: () => void) =>
    (["aggregation", "transform"] as const).map((kind) => ({
      title: kind,
      items: functions
        .filter((fn) => fn.kind === kind)
        .map((fn) => ({
          label: fn.name,
          onPick: () => {
            const expression = functionExpression(fn, selectedColumn ?? COLUMN_PLACEHOLDER);
            setExpr(expression);
            if (selectedColumn) run(expression);
            close();
          },
        })),
    }));

  const resetToSource = () => deleteView(path).then(fetchViews).then(setViews);

  return (
    <div className="group grow">
      <MenuButton
        icon="trash"
        ghost
        title={runRef ? "delete run" : "delete selection"}
        disabled={lineSelection === null}
      >
        {() => (
          <Menu>
            <Button label="confirm" onClick={deleteSelection} />
          </Menu>
        )}
      </MenuButton>
      <MenuButton icon="rename" ghost title="rename run" disabled={runRef === null}>
        {() => <RenamePanel onApply={renameSelection} />}
      </MenuButton>
      {selection && table.column_names && functions.length > 0 && (
        <MenuButton icon="fx" ghost title="apply statistic">
          {(close) => <Menu sections={catalogSections(close)} />}
        </MenuButton>
      )}
      <Button icon="reset" ghost title="reset to source" disabled={!savedView} onClick={resetToSource} />
      {selection && (
        <div className="anchor grow">
          <input
            className={expr.includes(COLUMN_PLACEHOLDER) ? "grow picking" : "grow"}
            placeholder="formula: derive(z = zscore(loss, 100)) | select(step, z)"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && expr.trim() && !e.defaultPrevented) run(expr);
            }}
          />
          {evalState === "error" && <span className="error">{evalError}</span>}
          {suggestions.length > 0 && (
            <Menu
              items={suggestions.map((name) => ({
                label: name,
                onPick: () => setExpr(expr.slice(0, expr.length - word.length) + name),
              }))}
            />
          )}
        </div>
      )}
      <MenuButton icon="save" ghost title="export">
        {(close) => (
          <Menu
            sections={[
              {
                title: "export as",
                items: [
                  { label: "csv", onPick: () => { exportCsv(table); close(); } },
                  { label: "json", onPick: () => { exportJson(table); close(); } },
                  { label: "png", onPick: () => { attempt("png export", () => exportPng(content.current, table.name)); close(); } },
                ],
              },
              {
                title: "line color",
                items: SERIES.map((token) => ({
                  label: token.slice(2),
                  swatch: `var(${token})`,
                  onPick: () => { setAccent(token); close(); },
                })),
              },
            ]}
          />
        )}
      </MenuButton>
    </div>
  );
}
