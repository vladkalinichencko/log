import { makeFsm } from "./baseFsm";

export type MenuState = "closed" | "open";
type MenuEvent = "toggle" | "close";

export const menuFsm = makeFsm<MenuState, MenuEvent>(["closed", "open"], {
  closed: { toggle: "open" },
  open: { toggle: "closed", close: "closed" },
});
