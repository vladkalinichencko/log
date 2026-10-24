import { useState } from "react";
import { dragFsm } from "../fsm/dragFsm";

interface ResizeHandleProps {
  onResize: (dw: number, dh: number, done: boolean) => void;
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const [state, setState] = useState(dragFsm.initial);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    setState((s) => dragFsm.next(s, "down"));
    const move = (ev: MouseEvent) => onResize(ev.clientX - start.x, ev.clientY - start.y, false);
    const up = (ev: MouseEvent) => {
      onResize(ev.clientX - start.x, ev.clientY - start.y, true);
      setState((s) => dragFsm.next(s, "up"));
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return <div className="resize-handle" data-state={state} onMouseDown={onMouseDown} />;
}
