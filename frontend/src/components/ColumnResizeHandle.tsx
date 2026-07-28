import { useState } from "react";
import { resizeFsm } from "../fsm/resizeFsm";

export function ColumnResizeHandle({ onResize }: { onResize: (width: number) => void }) {
  const [state, setState] = useState(resizeFsm.initial);

  return (
    <span
      className="column-resize"
      data-state={state}
      role="separator"
      aria-orientation="vertical"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = event.currentTarget.closest("th")!.getBoundingClientRect().width;
        setState(resizeFsm.next(state, "down"));
        const move = (next: MouseEvent) => onResize(Math.max(80, startWidth + next.clientX - startX));
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
