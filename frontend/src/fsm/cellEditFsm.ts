import { makeFsm } from "./baseFsm";

type CellEditState = "display" | "editing";
type CellEditEvent = "begin" | "enter" | "esc";

export const cellEditFsm = makeFsm<CellEditState, CellEditEvent>(
  ["display", "editing"],
  {
    display: { begin: "editing" },
    editing: { enter: "display", esc: "display" },
  },
);
