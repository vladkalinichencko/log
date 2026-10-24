import { describe, it, expect } from "vitest";
import { cellEditFsm } from "../fsm/cellEditFsm";

// cellEditFsm derives from makeFsm, so this also exercises the base factory:
// initial = first state, valid events transition, invalid events are ignored.
describe("cellEditFsm", () => {
  it("starts in display (the first declared state)", () => {
    expect(cellEditFsm.initial).toBe("display");
  });

  it("double-click opens editing; enter and esc return to display", () => {
    expect(cellEditFsm.next("display", "begin")).toBe("editing");
    expect(cellEditFsm.next("editing", "enter")).toBe("display");
    expect(cellEditFsm.next("editing", "esc")).toBe("display");
  });

  it("ignores an event with no transition (stays in the same state)", () => {
    expect(cellEditFsm.next("display", "enter")).toBe("display");
  });
});
