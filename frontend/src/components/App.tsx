import { useEffect, useState } from "react";
import { NavBar } from "./NavBar";
import { RepresentationSwitcher } from "./RepresentationSwitcher";
import { render } from "./render";
import { useStore } from "../store/store";
import { fetchTable } from "../api/client";
import { Table } from "../types/domain";

export function App() {
  const currentPath = useStore((state: any) => state.currentPath);
  const tables_loadTable = useStore((state: any) => state.tables_loadTable);
  const [currentTable, setCurrentTable] = useState<Table | null>(null);

  const tileId = currentTable ? currentTable.source_path || currentTable.name : "";
  const chosen = useStore((state: any) => state.tiles.get(tileId)?.representation);

  useEffect(() => {
    fetchTable(currentPath)
      .then((table) => {
        tables_loadTable(table);
        setCurrentTable(table);
      })
      .catch((err) => {
        console.error("Failed to load table:", err);
      });
  }, [currentPath]);

  if (!currentTable) return <div><NavBar /><div>Loading...</div></div>;

  const representation = chosen ?? currentTable.representation;
  return (
    <div>
      <NavBar />
      <RepresentationSwitcher table={currentTable} tileId={tileId} />
      {render(currentTable, representation)}
    </div>
  );
}
