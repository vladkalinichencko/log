import { useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { evalTable } from "../api/client";
import { useStore } from "../store/store";

interface ToolbarProps {
  path: string;
}

export function Toolbar({ path }: ToolbarProps) {
  const replace = useStore((state: any) => state.tables_replace);
  const [expr, setExpr] = useState("");
  const [evalState, setEvalState] = useState(loadFsm.initial);

  const run = () => {
    const expression = expr.trim().startsWith("table(") ? expr : `table(${path}) | ${expr}`;
    setEvalState((s) => loadFsm.next(s, "fetch"));
    evalTable(expression)
      .then((table) => {
        replace(path, table);
        setEvalState((s) => loadFsm.next(s, "success"));
      })
      .catch(() => setEvalState((s) => loadFsm.next(s, "failure")));
  };

  return (
    <div className="group grow">
      <input
        className="grow"
        placeholder="formula: derive(z = zscore(loss, 100)) | select(step, z)"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && expr.trim()) run();
        }}
      />
      {evalState === "error" && <span className="error">invalid expression</span>}
    </div>
  );
}
