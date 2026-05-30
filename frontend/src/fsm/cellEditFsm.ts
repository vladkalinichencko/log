import { makeFsm } from "./baseFsm";

type CellEditState = "display" | "editing";
type CellEditEvent = "dblclick" | "enter" | "esc";

export const cellEditFsm = makeFsm<CellEditState, CellEditEvent>(
  ["display", "editing"],
  {
    display: { dblclick: "editing" },
    editing: { enter: "display", esc: "display" },
  },
);
