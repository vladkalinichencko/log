import { useRef, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { useMenu } from "../fsm/useMenu";
import { evalTable, deleteRun, renameRuns } from "../api/client";
import { exportCsv, exportJson } from "./exportTable";
import { Button } from "./Button";
import { Menu } from "./Menu";
import { RenamePanel } from "./RenamePanel";
import { Table, CellType } from "../types/domain";
import { TableFunction } from "../store/slices/tablesSlice";
import { ACCENTS } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";

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
  const functions = useStore((state: any) => state.functions);
  const focused = useStore((state: any) => state.focused);
  const [expr, setExpr] = useState("");
  const suggestAnchor = useRef<HTMLDivElement>(null);
  const [evalState, setEvalState] = useState(loadFsm.initial);
  const [catalogState, openCatalog, closeCatalog] = useMenu();
  const [exportState, openExport, closeExport] = useMenu();
  const [confirmState, openConfirm, closeConfirm] = useMenu();
  const [renameState, openRename, closeRename] = useMenu();

  const selection = focused && focused.tableId === path ? focused : null;
  const lineSelection = selection && selection.kind !== "cell" ? selection : null;

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

  const targetColumn =
    selection && selection.c >= 0
      ? table.column_names?.[selection.c]
      : table.column_names?.[table.column_names.length - 1];

  const word = expr.match(/[A-Za-z_]\w*$/)?.[0] ?? "";
  const suggestions =
    word.length > 0
      ? [
          ...(table.column_names ?? []),
          ...functions.map((fn: TableFunction) => fn.name),
        ]
          .filter((name) => name.startsWith(word) && name !== word)
          .slice(0, 8)
      : [];

  const catalogSections = ["aggregation", "transform"].map((kind) => ({
    title: kind,
    items: functions
      .filter((fn: TableFunction) => fn.kind === kind)
      .map((fn: TableFunction) => ({
        label: fn.name,
        onPick: () => {
          const expression = functionExpression(fn, targetColumn ?? "");
          setExpr(expression);
          run(expression);
          closeCatalog();
        },
      })),
  }));

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
      {selection && targetColumn && functions.length > 0 && (
        <div className="anchor" onClick={(e) => e.stopPropagation()}>
          <Button icon="fx" ghost title="apply statistic" onClick={openCatalog} />
          {catalogState === "open" && <Menu sections={catalogSections} />}
        </div>
      )}
      {selection && (
        <div className="anchor grow" ref={suggestAnchor}>
          <input
            className="grow"
            placeholder="formula: derive(z = zscore(loss, 100)) | select(step, z)"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => {
              const navigating = suggestAnchor.current?.querySelector(".menu .active");
              if (e.key === "Enter" && expr.trim() && !navigating) run(expr);
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
