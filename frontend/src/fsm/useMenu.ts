import { useEffect, useState } from "react";
import { menuFsm } from "./menuFsm";

export const useMenu = (): [string, () => void, () => void] => {
  const [state, setState] = useState(menuFsm.initial);
  const open = () => setState((s) => menuFsm.next(s, "open"));
  const close = () => setState((s) => menuFsm.next(s, "close"));
  useEffect(() => {
    if (state !== "open") return;
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [state]);
  return [state, open, close];
};
