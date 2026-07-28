import { useState } from "react";
import { resizeFsm } from "../fsm/resizeFsm";

interface TableResizeHandleProps {
  axis: "column" | "row";
  onResize: (size: number) => void;
}

export function TableResizeHandle({ axis, onResize }: TableResizeHandleProps) {
  const [state, setState] = useState(resizeFsm.initial);

  return (
    <span
      className={`${axis}-resize`}
      data-state={state}
      role="separator"
      aria-orientation={axis === "column" ? "vertical" : "horizontal"}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const start = axis === "column" ? event.clientX : event.clientY;
        const rect = event.currentTarget.closest(axis === "column" ? "th" : "tr")!
          .getBoundingClientRect();
        const initial = axis === "column" ? rect.width : rect.height;
        const minimum = axis === "column" ? 80 : 24;
        setState(resizeFsm.next(state, "down"));
        const move = (next: MouseEvent) => {
          const pointer = axis === "column" ? next.clientX : next.clientY;
          onResize(Math.max(minimum, initial + pointer - start));
        };
        const up = () => {
          setState((current) => resizeFsm.next(current, "up"));
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
    />
  );
}
