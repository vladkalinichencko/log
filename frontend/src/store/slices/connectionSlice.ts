import { connectionFsm, ConnectionEvent, ConnectionStatus } from "../../fsm/connectionFsm";
import type { SetStore } from "../store";

export interface ConnectionState {
  status: ConnectionStatus;
  liveTick: number;
}

export const createConnectionSlice = (set: SetStore) => ({
  status: connectionFsm.initial,
  liveTick: 0,

  connection_event: (event: ConnectionEvent) =>
    set((state) => ({ status: connectionFsm.next(state.status, event) })),

  connection_bump: () => set((state) => ({ liveTick: state.liveTick + 1 })),
});
