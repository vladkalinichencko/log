import { makeFsm } from "./baseFsm";

type ButtonState = "idle" | "hover" | "pressed" | "pending" | "error";
type ButtonEvent = "mouseenter" | "mouseleave" | "mousedown" | "mouseup" | "start" | "success" | "failure";

export const buttonFsm = makeFsm<ButtonState, ButtonEvent>(
  ["idle", "hover", "pressed", "pending", "error"],
  {
    idle: { mouseenter: "hover", start: "pending" },
    hover: { mouseleave: "idle", mousedown: "pressed", start: "pending" },
    pressed: { mouseup: "hover", mouseleave: "idle" },
    pending: { success: "idle", failure: "error" },
    error: { mouseleave: "idle", start: "pending" },
  },
);
