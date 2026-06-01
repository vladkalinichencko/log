import { useState } from "react";
import { deleteConfirmFsm } from "../fsm/deleteConfirmFsm";

interface DotMenuProps {
  onDelete: () => void;
}

export function DotMenu({ onDelete }: DotMenuProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(deleteConfirmFsm.initial);

  if (!open) {
    return (
      <span style={{ cursor: "pointer" }} onClick={() => setOpen(true)}>
        ⋯
      </span>
    );
  }
  if (state === "idle") {
    return (
      <span style={{ cursor: "pointer" }} onClick={() => setState(deleteConfirmFsm.next(state, "delete"))}>
        delete
      </span>
    );
  }
  return (
    <span
      style={{ cursor: "pointer" }}
      onClick={() => {
        setState(deleteConfirmFsm.next(state, "confirmed"));
        setOpen(false);
        onDelete();
      }}
    >
      confirm?
    </span>
  );
}
