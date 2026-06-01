import { makeFsm } from "./baseFsm";

type ResizeState = "idle" | "dragging";
type ResizeEvent = "down" | "up";

export const resizeFsm = makeFsm<ResizeState, ResizeEvent>(
  ["idle", "dragging"],
  {
    idle: { down: "dragging" },
    dragging: { up: "idle" },
  },
);
