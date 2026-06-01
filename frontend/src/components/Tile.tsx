import { useEffect, useState } from "react";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { render } from "./render";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { fetchTable } from "../api/client";
import { Table } from "../types/domain";

interface TileProps {
  path: string;
}

export function Tile({ path }: TileProps) {
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const [table, setTable] = useState<Table | null>(null);
  const tables_loadTable = useStore((state: any) => state.tables_loadTable);
  const chosen = useStore((state: any) => state.tiles.get(path)?.representation);
  const liveTick = useStore((state: any) => state.liveTick);

  useEffect(() => {
    setLoadState(loadFsm.next(loadFsm.initial, "fetch"));
    fetchTable(path)
      .then((loaded) => {
        tables_loadTable(loaded);
        setTable(loaded);
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
      {render(table, representation)}
    </div>
  );
}
