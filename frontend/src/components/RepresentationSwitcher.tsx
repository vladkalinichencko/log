import { Table, Representation } from "../types/domain";
import { applicable } from "./render";
import { useStore } from "../store/store";
import { Button } from "./Button";

interface RepresentationSwitcherProps {
  table: Table;
  tileId: string;
}

const CHART_REPS = [Representation.Line, Representation.Heatmap, Representation.Histogram];

export function RepresentationSwitcher({ table, tileId }: RepresentationSwitcherProps) {
  const setRepresentation = useStore((state: any) => state.tiles_setRepresentation);
  const setMode = useStore((state: any) => state.tiles_setMode);
  const mode = useStore((state: any) => state.tiles.get(tileId)?.mode) ?? "table";

  const reps = applicable(table);
  const tableReps = reps.filter((r) => r === Representation.Grid || r === Representation.List);
  const chartReps = reps.filter((r) => CHART_REPS.includes(r));

  return (
    <div>
      <Button label="table" onClick={() => setMode(tileId, "table")} />
      <Button label="visualization" onClick={() => setMode(tileId, "visualization")} />
      {mode === "table" ? (
        tableReps.map((rep) => (
          <Button key={rep} label={rep} onClick={() => setRepresentation(tileId, rep)} />
        ))
      ) : (
        <select
          value=""
          onChange={(e) => setRepresentation(tileId, e.target.value as Representation)}
        >
          <option value="" disabled>
            chart…
          </option>
          {chartReps.map((rep) => (
            <option key={rep} value={rep}>
              {rep}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
