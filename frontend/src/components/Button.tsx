import { useState } from "react";
import { buttonFsm } from "../fsm/buttonFsm";

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  const [state, setState] = useState(buttonFsm.initial);

  return (
    <button
      onMouseEnter={() => setState(buttonFsm.next(state, "mouseenter"))}
      onMouseLeave={() => setState(buttonFsm.next(state, "mouseleave"))}
      onMouseDown={() => setState(buttonFsm.next(state, "mousedown"))}
      onMouseUp={() => setState(buttonFsm.next(state, "mouseup"))}
      onClick={() => {
        setState(buttonFsm.next(state, "click"));
        onClick();
      }}
    >
      {label}
    </button>
  );
}
