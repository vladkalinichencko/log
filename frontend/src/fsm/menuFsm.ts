import { makeFsm } from "./baseFsm";

type MenuState = "closed" | "open";
type MenuEvent = "open" | "close";

export const menuFsm = makeFsm<MenuState, MenuEvent>(["closed", "open"], {
  closed: { open: "open" },
  open: { close: "closed", open: "open" },
});
