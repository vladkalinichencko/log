import { HTMLAttributes, useEffect, useRef, useState } from "react";
import { cellEditFsm } from "../fsm/cellEditFsm";

interface EditableTextProps extends HTMLAttributes<HTMLSpanElement> {
  value: string;
  onCommit: (value: string) => void;
}

export function EditableText({ value, onCommit, ...span }: EditableTextProps) {
  const [state, setState] = useState(cellEditFsm.initial);
  const [draft, setDraft] = useState(value);
  const send = (event: Parameters<typeof cellEditFsm.next>[1]) => setState((current) => cellEditFsm.next(current, event));
  const spanRef = useRef<HTMLSpanElement>(null);
  const edited = useRef(false);
  const begin = () => {
    setDraft(value);
    edited.current = true;
    send("begin");
  };

  useEffect(() => {
    if (state !== "display" || !edited.current) return;
    edited.current = false;
    spanRef.current?.focus();
  }, [state]);

  if (state === "editing") {
    return (
      <input
        className="cell-input"
        size={1}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onCommit(draft);
            send("enter");
          } else if (e.key === "Escape") {
            send("esc");
          }
        }}
      />
    );
  }
  return (
    <span
      {...span}
      ref={spanRef}
      tabIndex={-1}
      onDoubleClick={begin}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== "F2") return;
        e.preventDefault();
        begin();
      }}
    >
      {value}
    </span>
  );
}
