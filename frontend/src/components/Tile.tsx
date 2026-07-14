import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { Toolbar } from "./Toolbar";
import { Player } from "./Player";
import { Button } from "./Button";
import { render, chartReps } from "./render";
import { Representation } from "../types/domain";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { fetchTable, fetchTensorSteps, fetchViews, saveView } from "../api/client";

interface TensorFrames {
  run: string;
  tensorPath: string;
  steps: number[];
}

const TENSOR_PATH = /^([^.]+)\.([^.]+)\.epoch_\d+\.(.+)$/;

interface TileProps {
  path: string;
}

export function Tile({ path }: TileProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const loadTable = useStore((state: any) => state.tables_loadTable);
  const setViews = useStore((state: any) => state.tables_setViews);
  const table = useStore((state: any) => state.tables.get(path));
  const savedView = useStore((state: any) => state.views.get(path));
  const chosen = useStore((state: any) => state.tiles.get(path)?.representation);
  const mode = useStore((state: any) => state.tiles.get(path)?.mode) ?? "table";
  const liveTick = useStore((state: any) => state.liveTick);
  const [frames, setFrames] = useState<TensorFrames | null>(null);

  useEffect(() => {
    setFrames(null);
    const match = path.match(TENSOR_PATH);
    if (!match) return;
    const [, project, run, tensorPath] = match;
    let stale = false;
    fetchTensorSteps(`${project}/${run}`, tensorPath)
      .then((steps) => {
        if (stale || steps === null) return;
        setFrames({ run: `${project}/${run}`, tensorPath, steps });
      })
      .catch((err) => console.error("Failed to fetch tensor steps:", err));
    return () => {
      stale = true;
    };
  }, [path]);

  useEffect(() => {
    setLoadState(loadFsm.next(loadFsm.initial, "fetch"));
    if (savedView) {
      loadTable(path, savedView);
      setLoadState((s) => loadFsm.next(s, "success"));
      return;
    }
    let stale = false;
    fetchTable(path)
      .then((loaded) => {
        if (stale) return;
        loadTable(path, loaded);
        setLoadState((s) => loadFsm.next(s, "success"));
      })
      .catch(() => {
        if (stale) return;
        setLoadState((s) => loadFsm.next(s, "failure"));
      });
    return () => {
      stale = true;
    };
  }, [path, liveTick, savedView]);

  if (loadState === "error") return <div>Failed to load {path}</div>;
  if (!table) return <div>Loading…</div>;

  const expanded = searchParams.get("modal") === path;
  const charts = chartReps(table);
  const representation =
    mode === "visualization" && charts.length > 0
      ? charts.includes(chosen) ? chosen : charts[0]
      : Representation.Grid;
  return (
    <div className="tile-body">
      <div className="bar">
        <div className="group">
          <RepresentationSwitcher table={table} tileId={path} />
        </div>
        <Toolbar path={path} table={table} />
        <div className="group">
          {!expanded && (
            <Button icon="expand" ghost title="expand" onClick={() => setSearchParams({ modal: path })} />
          )}
          <Button
            icon="save"
            ghost
            title="save view"
            onClick={() =>
              saveView(path, { id: path, ...table, source_path: path })
                .then(() => fetchViews().then(setViews))
                .catch((err) => console.error("Failed to save view:", err))
            }
          />
        </div>
      </div>
      <div className="tile-content">{render(table, representation)}</div>
      {frames && frames.steps.length > 1 && (
        <Player path={path} run={frames.run} tensorPath={frames.tensorPath} steps={frames.steps} />
      )}
    </div>
  );
}
