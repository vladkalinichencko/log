import { makeFsm } from "./baseFsm";

type TrailState = "off" | "on";
type TrailEvent = "toggle";

export const trailFsm = makeFsm<TrailState, TrailEvent>(["off", "on"], {
  off: { toggle: "on" },
  on: { toggle: "off" },
});
