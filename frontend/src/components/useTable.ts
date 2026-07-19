import { useEffect, useState } from "react";
import { loadFsm } from "../fsm/loadFsm";
import { useStore } from "../store/store";
import { fetchTable, fetchScalarSeries } from "../api/client";
import { Table, TableKind, CellType, Representation } from "../types/domain";

const SCALAR_PATH = /^([^.]+)\.([^.]+)\.epoch_\d+\.(.+)$/;

function seriesTable(path: string, metric: string, series: { x: number[]; y: number[] }): Table {
  return {
    name: metric,
    kind: TableKind.Column,
    column_names: ["step", metric],
    row_names: null,
    cells: series.x.map((x, i) => [
      { type: CellType.Number, value: String(x), ref: null },
      { type: CellType.Number, value: String(series.y[i]), ref: null },
    ]),
    representation: Representation.Line,
    source_path: path,
  };
}

export function useTable(path: string): { table: Table | undefined; loadState: string } {
  const [loadState, setLoadState] = useState(loadFsm.initial);
  const loadTable = useStore((state: any) => state.tables_loadTable);
  const table = useStore((state: any) => state.tables.get(path));
  const savedView = useStore((state: any) => state.views.get(path));
  const liveTick = useStore((state: any) => state.liveTick);

  useEffect(() => {
    setLoadState(loadFsm.next(loadFsm.initial, "fetch"));
    if (savedView) {
      loadTable(path, savedView);
      setLoadState((s) => loadFsm.next(s, "success"));
      return;
    }
    let stale = false;
    const match = path.match(SCALAR_PATH);
    const load = match
      ? fetchScalarSeries(`${match[1]}/${match[2]}`, match[3]).then((series) =>
          series ? seriesTable(path, match[3], series) : fetchTable(path)
        )
      : fetchTable(path);
    load
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

  return { table, loadState };
}
