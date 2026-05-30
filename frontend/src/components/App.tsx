import { useEffect, useState } from "react";
import { NavBar } from "./NavBar";
import { TableView } from "./TableView";
import { useStore } from "../store/store";
import { fetchTable } from "../api/client";
import { Table } from "../types/domain";

export function App() {
  const currentPath = useStore((state: any) => state.currentPath);
  const tables_loadTable = useStore((state: any) => state.tables_loadTable);
  const [currentTable, setCurrentTable] = useState<Table | null>(null);

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

  return (
    <div>
      <NavBar />
      {currentTable ? <TableView table={currentTable} /> : <div>Loading...</div>}
    </div>
  );
}
