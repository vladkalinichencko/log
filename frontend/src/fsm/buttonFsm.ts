import { makeFsm } from "./baseFsm";

type ButtonState = "idle" | "hover" | "pressed" | "pending" | "done" | "error";
type ButtonEvent =
  | "mouseenter"
  | "mouseleave"
  | "mousedown"
  | "mouseup"
  | "click"
  | "success"
  | "failure"
  | "reset";

export const buttonFsm = makeFsm<ButtonState, ButtonEvent>(
  ["idle", "hover", "pressed", "pending", "done", "error"],
  {
    idle: { mouseenter: "hover", click: "pending" },
    hover: { mouseleave: "idle", mousedown: "pressed", click: "pending" },
    pressed: { mouseup: "hover", mouseleave: "idle" },
    pending: { success: "done", failure: "error" },
    done: { reset: "idle" },
    error: { reset: "idle" },
  },
);
