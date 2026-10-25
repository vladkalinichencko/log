import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { Toolbar } from "./Toolbar";
import { Player } from "./Player";
import { Button } from "./Button";
import { LoadError } from "./LoadError";
import { Placeholder } from "./Placeholder";
import { render, chartReps } from "./render";
import { Representation } from "../types/domain";
import { useStore } from "../store/store";
import { with_param } from "../store/selectors/pathSelectors";
import { useTable } from "./useTable";
import { useTensor } from "./useTensor";

interface TileProps {
  path: string;
  editor?: boolean;
  titled?: boolean;
}

export function Tile({ path, editor, titled }: TileProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { table, loadState, error, retry } = useTable(path);
  const { tensor, leaf } = useTensor(path, table);
  const chosen = useStore((state) => state.tiles.get(path)?.representation);
  const mode = useStore((state) => state.tiles.get(path)?.mode) ?? "table";
  const content = useRef<HTMLDivElement>(null);

  if (loadState === "error") return <LoadError message={error} retry={retry} />;
  if (!table) return <Placeholder label="loading" />;

  const expanded = searchParams.get("modal") === path;
  const setModal = (nextPath: string | null) => setSearchParams(with_param(searchParams, "modal", nextPath));
  const charts = chartReps(table);
  const chart = chosen && charts.includes(chosen) ? chosen : charts[0];
  const representation = mode === "visualization" && chart ? chart : Representation.Grid;
  return (
    <div className="tile-body">
      <div className="bar">
        <div className="group">
          {titled &&
            (editor ? (
              <span className="tile-name">{table.name}</span>
            ) : (
              <Link className="tile-name link" to={"/" + path}>
                {table.name}
              </Link>
            ))}
          <RepresentationSwitcher tileId={path} mode={mode} charts={charts} chart={chart} />
        </div>
        {editor && <Toolbar path={path} table={table} content={content} />}
        <div className="group">
          {expanded ? (
            <Button icon="collapse" ghost title="collapse" onClick={() => setModal(null)} />
          ) : (
            <Button icon="expand" ghost title="expand" onClick={() => setModal(path)} />
          )}
        </div>
      </div>
      <div className="tile-content" ref={content}>{render(table, representation, editor ? "edit" : "preview")}</div>
      {tensor && tensor.steps.length > 1 && <Player path={path} leaf={leaf} tensor={tensor} />}
    </div>
  );
}
