import { describe, it, expect } from "vitest";
import { useStore } from "../store/store";

describe("connectionSlice", () => {
  it("connection_bump increments liveTick", () => {
    const s = useStore.getState;
    const before = s().liveTick;
    s().connection_bump();
    expect(s().liveTick).toBe(before + 1);
  });

  it("connection_event drives the connection FSM", () => {
    const s = useStore.getState;
    s().connection_event("close");
    expect(s().status).toBe("reconnecting");
    s().connection_event("open");
    expect(s().status).toBe("connected");
  });
});
