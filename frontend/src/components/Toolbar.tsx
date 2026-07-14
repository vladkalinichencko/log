import { useEffect, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { menuFsm } from "../fsm/menuFsm";
import { evalTable } from "../api/client";
import { Button } from "./Button";
import { Menu } from "./Menu";
import { Table } from "../types/domain";
import { TableFunction } from "../store/slices/tablesSlice";
import { useStore } from "../store/store";

export function functionExpression(fn: TableFunction, column: string): string {
  const args = fn.windowed ? `${column}, 20` : column;
  return `derive(${fn.name}_${column} = ${fn.name}(${args}))`;
}

interface ToolbarProps {
  path: string;
  table: Table;
}

export function Toolbar({ path, table }: ToolbarProps) {
  const replace = useStore((state: any) => state.tables_replace);
  const functions = useStore((state: any) => state.functions);
  const [expr, setExpr] = useState("");
  const [evalState, setEvalState] = useState(loadFsm.initial);
  const [catalogState, setCatalogState] = useState(menuFsm.initial);

  const closeCatalog = () => setCatalogState((s) => menuFsm.next(s, "close"));

  useEffect(() => {
    if (catalogState !== "open") return;
    window.addEventListener("click", closeCatalog);
    return () => window.removeEventListener("click", closeCatalog);
  }, [catalogState]);

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

  const lastColumn = table.column_names?.[table.column_names.length - 1];

  return (
    <div className="group grow">
      {lastColumn && functions.length > 0 && (
        <div className="anchor" onClick={(e) => e.stopPropagation()}>
          <Button
            icon="fx"
            ghost
            title="apply statistic"
            onClick={() => setCatalogState((s) => menuFsm.next(s, "open"))}
          />
          {catalogState === "open" && (
            <Menu
              items={functions.map((fn: TableFunction) => ({
                label: `${fn.name} — ${fn.kind}`,
                onPick: () => {
                  const expression = functionExpression(fn, lastColumn);
                  setExpr(expression);
                  run(expression);
                  closeCatalog();
                },
              }))}
            />
          )}
        </div>
      )}
      <input
        className="grow"
        placeholder="formula: derive(z = zscore(loss, 100)) | select(step, z)"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && expr.trim()) run(expr);
        }}
      />
      {evalState === "error" && <span className="error">invalid expression</span>}
    </div>
  );
}
