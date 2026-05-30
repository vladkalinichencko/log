import { Table } from "../types/domain";

const API_BASE = "http://localhost:8000";

export async function fetchTable(path: string): Promise<Table> {
  const url = `${API_BASE}/api/table?path=${encodeURIComponent(path)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch table: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRuns(): Promise<any[]> {
  const url = `${API_BASE}/api/runs`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch runs: ${response.statusText}`);
  }
  return response.json();
}
