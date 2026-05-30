import { makeFsm } from "./baseFsm";

type LoadState = "idle" | "loading" | "loaded" | "error";
type LoadEvent = "fetch" | "success" | "failure" | "reset";

export const loadFsm = makeFsm<LoadState, LoadEvent>(
  ["idle", "loading", "loaded", "error"],
  {
    idle: { fetch: "loading" },
    loading: { success: "loaded", failure: "error" },
    loaded: { fetch: "loading", reset: "idle" },
    error: { fetch: "loading", reset: "idle" },
  },
);
