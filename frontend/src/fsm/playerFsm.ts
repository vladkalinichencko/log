import { makeFsm } from "./baseFsm";

type PlayerState = "paused" | "playing";
type PlayerEvent = "play" | "pause" | "end";

export const playerFsm = makeFsm<PlayerState, PlayerEvent>(["paused", "playing"], {
  paused: { play: "playing" },
  playing: { pause: "paused", end: "paused" },
});
