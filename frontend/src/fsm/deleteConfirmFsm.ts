import { makeFsm } from "./baseFsm";

type DeleteConfirmState = "idle" | "confirm";
type DeleteConfirmEvent = "delete" | "confirmed" | "cancel";

export const deleteConfirmFsm = makeFsm<DeleteConfirmState, DeleteConfirmEvent>(
  ["idle", "confirm"],
  {
    idle: { delete: "confirm" },
    confirm: { confirmed: "idle", cancel: "idle" },
  },
);
