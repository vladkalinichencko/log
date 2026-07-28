import { makeFsm } from "./baseFsm";

type SelectionState = "idle" | "dragging";
type SelectionEvent = "down" | "up";

export const selectionFsm = makeFsm<SelectionState, SelectionEvent>(
  ["idle", "dragging"],
  {
    idle: { down: "dragging" },
    dragging: { up: "idle" },
  },
);
