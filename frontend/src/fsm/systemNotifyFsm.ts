import { makeFsm } from "./baseFsm";
import type { SystemNotifications } from "../modules/notify";

export type SystemNotifyState = "checking" | "turning_on" | "turning_off" | SystemNotifications;
type SystemNotifyEvent = SystemNotifications | "turn_on" | "turn_off" | "failure";

export const systemNotifyFsm = makeFsm<SystemNotifyState, SystemNotifyEvent>(
  ["checking", "turning_on", "turning_off", "on", "off", "blocked", "unsupported"],
  {
    checking: { on: "on", off: "off", blocked: "blocked", unsupported: "unsupported" },
    off: { turn_on: "turning_on" },
    turning_on: { on: "on", off: "off", blocked: "blocked", failure: "off" },
    on: { turn_off: "turning_off" },
    turning_off: { off: "off", failure: "on" },
  },
);
