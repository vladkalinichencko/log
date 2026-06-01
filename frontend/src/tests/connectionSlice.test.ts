import { describe, it, expect } from "vitest";
import { useStore } from "../store/store";

describe("connectionSlice", () => {
  it("live_bump increments liveTick", () => {
    const s = () => useStore.getState() as any;
    const before = s().liveTick;
    s().live_bump();
    expect(s().liveTick).toBe(before + 1);
  });

  it("connection_event drives the connection FSM", () => {
    const s = () => useStore.getState() as any;
    s().connection_event("close");
    expect(s().status).toBe("reconnecting");
    s().connection_event("open");
    expect(s().status).toBe("connected");
  });
});
