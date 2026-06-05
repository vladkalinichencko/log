import { useState } from "react";
import { buttonFsm } from "../fsm/buttonFsm";
import { Icon } from "./Icon";

type IconName = "back" | "forward" | "plus" | "trash" | "pin" | "save" | "expand" | "table" | "chart";

interface ButtonProps {
  label?: string;
  icon?: IconName;
  ghost?: boolean;
  active?: boolean;
  title?: string;
  onClick: () => void;
}

export function Button({ label, icon, ghost, active, title, onClick }: ButtonProps) {
  const [state, setState] = useState(buttonFsm.initial);

  return (
    <button
      className={[ghost ? "ghost" : "", active ? "active" : ""].join(" ").trim()}
      title={title}
      onMouseEnter={() => setState(buttonFsm.next(state, "mouseenter"))}
      onMouseLeave={() => setState(buttonFsm.next(state, "mouseleave"))}
      onMouseDown={() => setState(buttonFsm.next(state, "mousedown"))}
      onMouseUp={() => setState(buttonFsm.next(state, "mouseup"))}
      onClick={() => {
        setState(buttonFsm.next(state, "click"));
        onClick();
      }}
    >
      {icon ? <Icon name={icon} /> : label}
    </button>
  );
}
