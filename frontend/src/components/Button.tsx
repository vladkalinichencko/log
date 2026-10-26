import { useState } from "react";
import { buttonFsm } from "../fsm/buttonFsm";
import { useStore } from "../store/store";
import { Icon, IconName } from "./Icon";

export interface ButtonProps {
  label?: string;
  icon?: IconName;
  swatch?: string;
  ghost?: boolean;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}

export function Button({ label, icon, swatch, ghost, active, disabled, title, onClick }: ButtonProps) {
  const [state, setState] = useState(buttonFsm.initial);
  const notify = useStore((store) => store.notices_push);
  const send = (event: Parameters<typeof buttonFsm.next>[1]) => setState((current) => buttonFsm.next(current, event));
  const perform = (event: React.MouseEvent<HTMLButtonElement>) => {
    const result = onClick(event);
    if (!(result instanceof Promise)) return;
    send("start");
    result.then(
      () => send("success"),
      (error: Error) => {
        send("failure");
        notify(`${title ?? label}: ${error.message}`, { label: "Retry", perform: () => perform(event) });
      }
    );
  };

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
      onClick={perform}
    >
      {icon ? <Icon name={icon} /> : swatch ? <span className="dot" style={{ background: swatch }} /> : label}
    </button>
  );
}
