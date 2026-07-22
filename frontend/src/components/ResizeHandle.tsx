import { useState, useRef } from "react";
import { resizeFsm } from "../fsm/resizeFsm";

interface ResizeHandleProps {
  onResize: (dw: number, dh: number) => void;
  onResizeEnd: (dw: number, dh: number) => void;
}

export function ResizeHandle({ onResize, onResizeEnd }: ResizeHandleProps) {
  const [state, setState] = useState(resizeFsm.initial);
  const start = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start.current = last.current = { x: e.clientX, y: e.clientY };
    setState(resizeFsm.next(state, "down"));
    const move = (ev: MouseEvent) => {
      onResize(ev.clientX - last.current.x, ev.clientY - last.current.y);
      last.current = { x: ev.clientX, y: ev.clientY };
    };
    const up = (ev: MouseEvent) => {
      onResizeEnd(ev.clientX - start.current.x, ev.clientY - start.current.y);
      setState((s) => resizeFsm.next(s, "up"));
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return <div className="resize-handle" onMouseDown={onMouseDown} />;
}
