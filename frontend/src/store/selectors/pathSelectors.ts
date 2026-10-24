const TENSOR_PATH = /^([^.]+)\.([^.]+)\.epoch_\d+\.(.+)$/;

export const path_segments = (path: string) => path.split(".").filter(Boolean);

export const is_run_ref = (ref: string | null) => ref !== null && path_segments(ref).length === 2;

export function with_param(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  value ? next.set(key, value) : next.delete(key);
  return next;
}

export function tensor_source(path: string): { run: string; leaf: string } | null {
  const match = path.match(TENSOR_PATH);
  return match ? { run: `${match[1]}/${match[2]}`, leaf: match[3] } : null;
}
