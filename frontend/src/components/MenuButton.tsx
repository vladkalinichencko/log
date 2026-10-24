import { ReactNode, useEffect, useState } from "react";
import { menuFsm } from "../fsm/menuFsm";
import { Button, ButtonProps } from "./Button";

interface MenuButtonProps extends Omit<ButtonProps, "onClick"> {
  children: (close: () => void) => ReactNode;
}

export function MenuButton({ children, ...button }: MenuButtonProps) {
  const [state, setState] = useState(menuFsm.initial);
  const close = () => setState((current) => menuFsm.next(current, "close"));

  useEffect(() => {
    if (state !== "open") return;
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [state]);

  return (
    <div className="anchor" onClick={(event) => event.stopPropagation()}>
      <Button {...button} onClick={() => setState((current) => menuFsm.next(current, "toggle"))} />
      {state === "open" && children(close)}
    </div>
  );
}
