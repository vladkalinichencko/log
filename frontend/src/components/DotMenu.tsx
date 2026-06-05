import { useState } from "react";
import { deleteConfirmFsm } from "../fsm/deleteConfirmFsm";
import { Icon } from "./Icon";

interface DotMenuProps {
  onDelete: () => void;
}

export function DotMenu({ onDelete }: DotMenuProps) {
  const [state, setState] = useState(deleteConfirmFsm.initial);
  const armed = state === "confirm";

  return (
    <button
      className={armed ? "ghost armed" : "ghost"}
      title={armed ? "click again to delete" : "delete"}
      onClick={() => {
        if (armed) {
          setState(deleteConfirmFsm.next(state, "confirmed"));
          onDelete();
        } else {
          setState(deleteConfirmFsm.next(state, "delete"));
        }
      }}
    >
      <Icon name="trash" />
    </button>
  );
}
