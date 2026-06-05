import { Table, Representation } from "../types/domain";
import { chartReps } from "./render";
import { useStore } from "../store/store";
import { Button } from "./Button";

interface RepresentationSwitcherProps {
  table: Table;
  tileId: string;
}

export function RepresentationSwitcher({ table, tileId }: RepresentationSwitcherProps) {
  const setRepresentation = useStore((state: any) => state.tiles_setRepresentation);
  const setMode = useStore((state: any) => state.tiles_setMode);
  const mode = useStore((state: any) => state.tiles.get(tileId)?.mode) ?? "table";
  const chosen = useStore((state: any) => state.tiles.get(tileId)?.representation);

  const charts = chartReps(table);
  if (charts.length === 0) return null;
  const isViz = mode === "visualization";

  return (
    <div className="toolbar">
      <div className="toggle">
        <Button icon="table" title="table" active={!isViz} onClick={() => setMode(tileId, "table")} />
        <Button icon="chart" title="visualization" active={isViz} onClick={() => setMode(tileId, "visualization")} />
      </div>
      {isViz && charts.length > 1 && (
        <select value={chosen ?? charts[0]} onChange={(e) => setRepresentation(tileId, e.target.value as Representation)}>
          {charts.map((rep) => (
            <option key={rep} value={rep}>
              {rep}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
