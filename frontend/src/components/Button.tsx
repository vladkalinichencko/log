import { useState } from "react";
import { buttonFsm } from "../fsm/buttonFsm";
import { Icon, IconName } from "./Icon";

export interface ButtonProps {
  label?: string;
  icon?: IconName;
  ghost?: boolean;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}

export function Button({ label, icon, ghost, active, disabled, title, onClick }: ButtonProps) {
  const [state, setState] = useState(buttonFsm.initial);
  const send = (event: Parameters<typeof buttonFsm.next>[1]) => setState((current) => buttonFsm.next(current, event));

  return (
    <button
      className={[ghost ? "ghost" : "", active ? "active" : ""].join(" ").trim()}
      data-state={state}
      disabled={disabled || state === "pending"}
      title={title}
      onMouseEnter={() => send("mouseenter")}
      onMouseLeave={() => send("mouseleave")}
      onMouseDown={() => send("mousedown")}
      onMouseUp={() => send("mouseup")}
      onClick={(event) => {
        const result = onClick(event);
        if (!(result instanceof Promise)) return;
        send("start");
        result.then(() => send("success"), () => send("failure"));
      }}
    >
      {icon ? <Icon name={icon} /> : label}
    </button>
  );
}
