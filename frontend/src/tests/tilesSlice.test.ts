import { describe, it, expect } from "vitest";
import { useStore } from "../store/store";

describe("tilesSlice pin/unpin", () => {
  it("pins a path at most once and unpins it", () => {
    const s = () => useStore.getState() as any;
    s().tiles_pin("p.r");
    s().tiles_pin("p.r");
    expect(s().pinned.filter((x: string) => x === "p.r").length).toBe(1);
    s().tiles_unpin("p.r");
    expect(s().pinned).not.toContain("p.r");
  });
});
