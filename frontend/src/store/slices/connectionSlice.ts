export interface ConnectionState {
  status: "connected" | "reconnecting";
}

export const createConnectionSlice = (set: any) => ({
  status: "connected" as "connected" | "reconnecting",

  connection_event: (event: "open" | "close" | "retry") =>
    set((state: any) => {
      if (event === "close") return { status: "reconnecting" };
      if (event === "open") return { status: "connected" };
      return state;
    }),
});
