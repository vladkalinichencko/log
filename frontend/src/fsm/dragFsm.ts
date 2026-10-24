import { makeFsm } from "./baseFsm";

type DragState = "idle" | "dragging";
type DragEvent = "down" | "up";

export const dragFsm = makeFsm<DragState, DragEvent>(
  ["idle", "dragging"],
  {
    idle: { down: "dragging" },
    dragging: { up: "idle" },
  },
);
