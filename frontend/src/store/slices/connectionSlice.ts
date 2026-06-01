import { connectionFsm } from "../../fsm/connectionFsm";

export interface ConnectionState {
  status: "connected" | "reconnecting";
  liveTick: number;
}

export const createConnectionSlice = (set: any) => ({
  status: connectionFsm.initial,
  liveTick: 0,

  connection_event: (event: "open" | "close" | "retry") =>
    set((state: any) => ({ status: connectionFsm.next(state.status, event) })),

  live_bump: () => set((state: any) => ({ liveTick: state.liveTick + 1 })),
});
