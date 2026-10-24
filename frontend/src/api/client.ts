import { SavedView, Table, TableFunction, Workspace } from "../types/domain";

export const fetchTable = (path: string) => request<Table>(`/api/table?${query({ path })}`);

export const fetchPaths = () => request<string[]>("/api/paths");

export const fetchFunctions = () => request<TableFunction[]>("/api/tables/functions");

export const evalTable = (expression: string) => request<Table>("/api/tables/eval", send("POST", { expression }));

export const fetchRunComparison = (runs: string[]) => request<Table>("/api/runs/compare", send("POST", { runs }));

export const fetchTensorSteps = (run: string, path: string) =>
  request<{ steps: number[] }>(`/api/series/tensor/steps?${query({ run, path })}`).then((body) => body.steps);

export const fetchTensorFrame = (run: string, path: string, step: number) =>
  request<{ shape: number[]; data: number[] }>(`/api/series/tensor?${query({ run, path, step })}`);

export const deleteRun = (project: string, run: string) =>
  request<{ deleted: true }>(`/api/runs/${project}/${run}`, { method: "DELETE" });

export const renameRuns = (
  run_refs: string[],
  fields: { prefix: string; suffix: string; find: string; replace: string }
) => request<{ renamed: Record<string, string> }>("/api/runs/rename", send("POST", { run_refs, ...fields }));

export const fetchViews = () => request<SavedView[]>("/api/views");

export const saveView = (view: SavedView) => request<SavedView>(`/api/views/${view.id}`, send("PUT", view));

export const deleteView = (id: string) => request<{ deleted: true }>(`/api/views/${id}`, { method: "DELETE" });

export const fetchWorkspaces = () => request<Workspace[]>("/api/workspaces");

export const saveWorkspace = (workspace: Workspace) =>
  request<Workspace>(`/api/workspaces/${workspace.id}`, send("PUT", workspace));

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? `${response.status} ${response.statusText}`);
  return body;
}

const send = (method: "POST" | "PUT", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
