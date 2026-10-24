import { Representation, TileMode } from "../types/domain";
import { useStore } from "../store/store";
import { Button } from "./Button";
import { Menu } from "./Menu";
import { MenuButton } from "./MenuButton";

interface RepresentationSwitcherProps {
  tileId: string;
  mode: TileMode;
  charts: Representation[];
  chart: Representation | undefined;
}

export function RepresentationSwitcher({ tileId, mode, charts, chart }: RepresentationSwitcherProps) {
  const setRepresentation = useStore((state) => state.tiles_setRepresentation);
  const setMode = useStore((state) => state.tiles_setMode);
  if (charts.length === 0) return null;

  return (
    <div className="group">
      <div className="toggle">
        <Button icon="table" title="table" active={mode === "table"} onClick={() => setMode(tileId, "table")} />
        <Button icon="chart" title="visualization" active={mode === "visualization"} onClick={() => setMode(tileId, "visualization")} />
      </div>
      {mode === "visualization" && charts.length > 1 && (
        <MenuButton label={`${chart} ▾`} ghost title="chart type">
          {(close) => (
            <Menu
              items={charts.map((rep) => ({
                label: rep,
                onPick: () => {
                  setRepresentation(tileId, rep);
                  close();
                },
              }))}
            />
          )}
        </MenuButton>
      )}
    </div>
  );
}
