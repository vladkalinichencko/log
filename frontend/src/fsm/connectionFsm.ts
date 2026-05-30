import { makeFsm } from "./baseFsm";

type ConnectionState = "connected" | "reconnecting";
type ConnectionEvent = "open" | "close" | "retry";

export const connectionFsm = makeFsm<ConnectionState, ConnectionEvent>(
  ["connected", "reconnecting"],
  {
    connected: { close: "reconnecting" },
    reconnecting: { open: "connected", retry: "reconnecting" },
  },
);
