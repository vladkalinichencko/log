import { Table, Representation } from "../types/domain";
import { chartReps } from "./render";
import { useMenu } from "../fsm/useMenu";
import { useStore } from "../store/store";
import { Button } from "./Button";
import { Menu } from "./Menu";

interface RepresentationSwitcherProps {
  table: Table;
  tileId: string;
}

export function RepresentationSwitcher({ table, tileId }: RepresentationSwitcherProps) {
  const setRepresentation = useStore((state: any) => state.tiles_setRepresentation);
  const setMode = useStore((state: any) => state.tiles_setMode);
  const mode = useStore((state: any) => state.tiles.get(tileId)?.mode) ?? "table";
  const chosen = useStore((state: any) => state.tiles.get(tileId)?.representation);
  const [pickerState, openPicker, closePicker] = useMenu();

  const charts = chartReps(table);
  if (charts.length === 0) return null;
  const isViz = mode === "visualization";

  return (
    <div className="group">
      <div className="toggle">
        <Button icon="table" title="table" active={!isViz} onClick={() => setMode(tileId, "table")} />
        <Button icon="chart" title="visualization" active={isViz} onClick={() => setMode(tileId, "visualization")} />
      </div>
      {isViz && charts.length > 1 && (
        <div className="anchor" onClick={(e) => e.stopPropagation()}>
          <Button
            label={`${chosen && charts.includes(chosen) ? chosen : charts[0]} ▾`}
            ghost
            title="chart type"
            onClick={() => (pickerState === "open" ? closePicker() : openPicker())}
          />
          {pickerState === "open" && (
            <Menu
              items={charts.map((rep) => ({
                label: rep,
                onPick: () => {
                  setRepresentation(tileId, rep as Representation);
                  closePicker();
                },
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
