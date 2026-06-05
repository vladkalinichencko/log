import { useState } from "react";
import { cellEditFsm } from "../fsm/cellEditFsm";

interface HeaderCellProps {
  name: string;
  onRename: (name: string) => void;
}

export function HeaderCell({ name, onRename }: HeaderCellProps) {
  const [state, setState] = useState(cellEditFsm.initial);
  const [value, setValue] = useState(name);

  if (state === "editing") {
    return (
      <input
        className="cell-input"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onRename(value);
            setState(cellEditFsm.next(state, "enter"));
          } else if (e.key === "Escape") {
            setValue(name);
            setState(cellEditFsm.next(state, "esc"));
          }
        }}
      />
    );
  }
  return (
    <span className="cell" onDoubleClick={() => setState(cellEditFsm.next(state, "dblclick"))}>
      {name}
    </span>
  );
}
