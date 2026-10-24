import { describe, it, expect } from "vitest";
import { formula_selector, search_selector } from "../store/selectors/searchSelectors";

describe("search_selector", () => {
  it("returns nothing for an empty query", () => {
    expect(search_selector({ query: "", paths: ["p.r.loss"] })).toEqual([]);
  });

  it("filters paths by substring", () => {
    const state = { query: "loss", paths: ["p.r.loss", "p.r.acc", "p.r.epoch_0000.loss"] };
    expect(search_selector(state)).toEqual(["p.r.loss", "p.r.epoch_0000.loss"]);
  });

  it("suggests hierarchical table paths in formulas", () => {
    const state = {
      functions: [{ name: "mean", kind: "aggregation" as const, windowed: false }],
      paths: ["demo.baseline.epoch_0000.loss", "demo.high_lr.epoch_0000.loss"],
    };
    expect(formula_selector(state, "join(table(demo.ba", ["step"]).suggestions).toEqual([
      "demo.baseline.epoch_0000.loss",
    ]);
  });
});
