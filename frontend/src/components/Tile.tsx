import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { Toolbar } from "./Toolbar";
import { Player } from "./Player";
import { Button } from "./Button";
import { render, chartReps } from "./render";
import { Representation } from "../types/domain";
import { useStore } from "../store/store";
import { useTable } from "./useTable";
import { fetchTensorSteps } from "../api/client";

interface TensorFrames {
  run: string;
  tensorPath: string;
  steps: number[];
}

const TENSOR_PATH = /^([^.]+)\.([^.]+)\.epoch_\d+\.(.+)$/;

interface TileProps {
  path: string;
  editor?: boolean;
  titled?: boolean;
}

export function Tile({ path, editor, titled }: TileProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { table, loadState } = useTable(path);
  const chosen = useStore((state: any) => state.tiles.get(path)?.representation);
  const mode = useStore((state: any) => state.tiles.get(path)?.mode) ?? "table";
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
          {titled &&
            (editor ? (
              <span className="tile-name">{table.name}</span>
            ) : (
              <span className="tile-name link" onClick={() => navigate("/" + path)}>
                {table.name}
              </span>
            ))}
        </div>
        {editor && <Toolbar path={path} table={table} />}
        <div className="group">
          {expanded ? (
            <Button icon="collapse" ghost title="collapse" onClick={() => setSearchParams({})} />
          ) : (
            <Button icon="expand" ghost title="expand" onClick={() => setSearchParams({ modal: path })} />
          )}
        </div>
      </div>
      <div className="tile-content">{render(table, representation, editor)}</div>
      {frames && frames.steps.length > 1 && (
        <Player path={path} run={frames.run} tensorPath={frames.tensorPath} steps={frames.steps} />
      )}
    </div>
  );
}
