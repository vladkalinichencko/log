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

export async function fetchWorkspaces(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/workspaces`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
  }
  return response.json();
}

export async function saveWorkspace(id: string, workspace: any): Promise<any> {
  const response = await fetch(`${API_BASE}/api/workspaces/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
  });
  if (!response.ok) {
    throw new Error(`Failed to save workspace: ${response.statusText}`);
  }
  return response.json();
}
