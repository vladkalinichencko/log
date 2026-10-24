import { makeFsm } from "./baseFsm";

export type LoadState = "idle" | "loading" | "loaded" | "error";
type LoadEvent = "fetch" | "success" | "failure";

export const loadFsm = makeFsm<LoadState, LoadEvent>(
  ["idle", "loading", "loaded", "error"],
  {
    idle: { fetch: "loading" },
    loading: { success: "loaded", failure: "error" },
    loaded: { fetch: "loading" },
    error: { fetch: "loading" },
  },
);
