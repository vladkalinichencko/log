import { useState, useRef } from "react";
import { resizeFsm } from "../fsm/resizeFsm";

interface ResizeHandleProps {
  onResize: (dw: number, dh: number) => void;
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const [state, setState] = useState(resizeFsm.initial);
  const last = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    last.current = { x: e.clientX, y: e.clientY };
    setState(resizeFsm.next(state, "down"));
    const move = (ev: MouseEvent) => {
      onResize(ev.clientX - last.current.x, ev.clientY - last.current.y);
      last.current = { x: ev.clientX, y: ev.clientY };
    };
    const up = () => {
      setState((s) => resizeFsm.next(s, "up"));
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return <div className="resize-handle" onMouseDown={onMouseDown} />;
}
