import { makeFsm } from "./baseFsm";

export type ConnectionStatus = "connected" | "reconnecting";
export type ConnectionEvent = "open" | "close";

export const connectionFsm = makeFsm<ConnectionStatus, ConnectionEvent>(
  ["connected", "reconnecting"],
  {
    connected: { close: "reconnecting" },
    reconnecting: { open: "connected" },
  },
);
