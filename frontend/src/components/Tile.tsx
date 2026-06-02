import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { Button } from "./Button";
import { render } from "./render";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { fetchTable, saveView } from "../api/client";

interface TileProps {
  path: string;
}

export function Tile({ path }: TileProps) {
  const [, setSearchParams] = useSearchParams();
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const loadTable = useStore((state: any) => state.tables_loadTable);
  const table = useStore((state: any) => state.tables.get(path));
  const savedView = useStore((state: any) => state.views.get(path));
  const chosen = useStore((state: any) => state.tiles.get(path)?.representation);
  const liveTick = useStore((state: any) => state.liveTick);

  useEffect(() => {
    setLoadState(loadFsm.next(loadFsm.initial, "fetch"));
    if (savedView) {
      loadTable(savedView);
      setLoadState((s) => loadFsm.next(s, "success"));
      return;
    }
    fetchTable(path)
      .then((loaded) => {
        loadTable(loaded);
        setLoadState((s) => loadFsm.next(s, "success"));
      })
      .catch(() => setLoadState((s) => loadFsm.next(s, "failure")));
  }, [path, liveTick]);

  if (loadState !== "loaded" || !table) {
    return <div>{loadState === "error" ? `Failed to load ${path}` : "Loading…"}</div>;
  }

  const representation = chosen ?? table.representation;
  return (
    <div>
      <RepresentationSwitcher table={table} tileId={path} />
      <Button label="expand" onClick={() => setSearchParams({ modal: path })} />
      <Button
        label="save view"
        onClick={() => saveView(path, { id: path, ...table, source_path: path })}
      />
      {render(table, representation)}
    </div>
  );
}
