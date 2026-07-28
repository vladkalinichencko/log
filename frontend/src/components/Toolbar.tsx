import { useEffect, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { useMenu } from "../fsm/useMenu";
import { evalTable, deleteRun, renameRuns, deleteView, fetchViews } from "../api/client";
import { exportCsv, exportJson } from "./exportTable";
import { Button } from "./Button";
import { Menu } from "./Menu";
import { RenamePanel } from "./RenamePanel";
import { Table, CellType } from "../types/domain";
import { TableFunction } from "../store/slices/tablesSlice";
import { ACCENTS } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";
import { formula_selector } from "../store/selectors/searchSelectors";

export const COLUMN_PLACEHOLDER = "«col»";

export function functionExpression(fn: TableFunction, column: string): string {
  const args = fn.windowed ? `${column}, 20` : column;
  return `derive(${fn.name}_${column} = ${fn.name}(${args}))`;
}

async function exportPng(filename: string) {
  const plot = document.querySelector(".js-plotly-plot");
  if (!plot) return;
  const Plotly = (await import("plotly.js")).default;
  Plotly.downloadImage(plot as HTMLElement, { format: "png", width: 1600, height: 900, filename });
}

interface ToolbarProps {
  path: string;
  table: Table;
}

export function Toolbar({ path, table }: ToolbarProps) {
  const replace = useStore((state: any) => state.tables_replace);
  const removeRow = useStore((state: any) => state.tables_removeRow);
  const removeColumn = useStore((state: any) => state.tables_removeColumn);
  const setTarget = useStore((state: any) => state.focus_setTarget);
  const setAccent = useStore((state: any) => state.settings_setAccent);
  const setViews = useStore((state: any) => state.tables_setViews);
  const setPicking = useStore((state: any) => state.focus_setPicking);
  const pickColumn = useStore((state: any) => state.focus_pickColumn);
  const pickedColumn = useStore((state: any) => state.pickedColumn);
  const functions = useStore((state: any) => state.functions);
  const focused = useStore((state: any) => state.focused);
  const paths = useStore((state: any) => state.paths);
  const savedView = useStore((state: any) => state.views.get(path));
  const [expr, setExpr] = useState("");
  const [evalState, setEvalState] = useState(loadFsm.initial);
  const [catalogState, openCatalog, closeCatalog] = useMenu();
  const [exportState, openExport, closeExport] = useMenu();
  const [confirmState, openConfirm, closeConfirm] = useMenu();
  const [renameState, openRename, closeRename] = useMenu();

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

  const selection = focused && focused.tableId === path ? focused : null;
  const activeSelection = selection?.ranges[selection.ranges.length - 1] ?? null;
  const lineSelection = activeSelection && activeSelection.kind !== "cell" ? activeSelection : null;

  const runRef =
    lineSelection?.kind === "row"
      ? table.cells[lineSelection.r]?.find(
          (cell) => cell.type === CellType.TableRef && cell.ref?.split(".").length === 2
        )?.ref ?? null
      : null;

  const run = (expression: string) => {
    const full = expression.trim().startsWith("table(")
      ? expression
      : `table(${path}) | ${expression}`;
    setEvalState((s) => loadFsm.next(s, "fetch"));
    evalTable(full)
      .then((result) => {
        replace(path, result);
        setEvalState((s) => loadFsm.next(s, "success"));
      })
      .catch(() => setEvalState((s) => loadFsm.next(s, "failure")));
  };

  const deleteSelection = () => {
    if (runRef) {
      const [project, name] = runRef.split(".");
      deleteRun(project, name).catch((err) => console.error("Failed to delete run:", err));
    } else if (lineSelection?.kind === "row") {
      removeRow(path, lineSelection.r);
    } else if (lineSelection?.kind === "col") {
      removeColumn(path, lineSelection.c);
    }
    setTarget(null);
    closeConfirm();
  };

  const renameSelection = (fields: { prefix: string; suffix: string; find: string; replace: string }) => {
    if (!runRef) return;
    renameRuns([runRef.replace(".", "/")], fields).catch((err) =>
      console.error("Failed to rename runs:", err)
    );
    setTarget(null);
    closeRename();
  };

  const selectedColumn =
    activeSelection && activeSelection.c >= 0
      ? table.column_names?.[activeSelection.c] ?? null
      : null;

  const { word, suggestions } = formula_selector(
    { functions, paths },
    expr,
    table.column_names ?? []
  );

  const catalogSections = ["aggregation", "transform"].map((kind) => ({
    title: kind,
    items: functions
      .filter((fn: TableFunction) => fn.kind === kind)
      .map((fn: TableFunction) => ({
        label: fn.name,
        onPick: () => {
          const expression = functionExpression(fn, selectedColumn ?? COLUMN_PLACEHOLDER);
          setExpr(expression);
          if (selectedColumn) run(expression);
          closeCatalog();
        },
      })),
  }));

  const resetToSource = () => {
    deleteView(path)
      .then(() => fetchViews().then(setViews))
      .catch((err) => console.error("Failed to reset view:", err));
  };

  return (
    <div className="group grow">
      <div className="anchor" onClick={(e) => e.stopPropagation()}>
        <Button
          icon="trash"
          ghost
          title={runRef ? "delete run" : "delete selection"}
          disabled={lineSelection === null}
          onClick={() => (confirmState === "open" ? closeConfirm() : openConfirm())}
        />
        {confirmState === "open" && (
          <Menu items={[{ label: "confirm", icon: "trash", onPick: deleteSelection }]} />
        )}
      </div>
      <div className="anchor" onClick={(e) => e.stopPropagation()}>
        <Button
          icon="rename"
          ghost
          title="rename run"
          disabled={runRef === null}
          onClick={() => (renameState === "open" ? closeRename() : openRename())}
        />
        {renameState === "open" && <RenamePanel onApply={renameSelection} />}
      </div>
      {selection && table.column_names && functions.length > 0 && (
        <div className="anchor" onClick={(e) => e.stopPropagation()}>
          <Button icon="fx" ghost title="apply statistic" onClick={openCatalog} />
          {catalogState === "open" && <Menu sections={catalogSections} />}
        </div>
      )}
      <Button
        icon="reset"
        ghost
        title="reset to source"
        disabled={!savedView}
        onClick={resetToSource}
      />
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
          {evalState === "error" && <span className="error">invalid expression</span>}
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
      <div className="anchor" onClick={(e) => e.stopPropagation()}>
        <Button
          icon="save"
          ghost
          title="export"
          onClick={() => (exportState === "open" ? closeExport() : openExport())}
        />
        {exportState === "open" && (
          <Menu
            sections={[
              {
                title: "export as",
                items: [
                  { label: "csv", onPick: () => { exportCsv(table); closeExport(); } },
                  { label: "json", onPick: () => { exportJson(table); closeExport(); } },
                  { label: "png", onPick: () => { exportPng(table.name); closeExport(); } },
                ],
              },
              {
                title: "line color",
                items: ACCENTS.map((color) => ({
                  label: color,
                  swatch: color,
                  onPick: () => { setAccent(color); closeExport(); },
                })),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
