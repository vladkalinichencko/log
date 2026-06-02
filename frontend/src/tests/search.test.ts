import { describe, it, expect } from "vitest";
import { search_selector } from "../store/selectors/searchSelectors";

describe("search_selector", () => {
  it("returns nothing for an empty query", () => {
    expect(search_selector({ query: "", paths: ["p.r.loss"] })).toEqual([]);
  });

  it("filters paths by substring", () => {
    const state = { query: "loss", paths: ["p.r.loss", "p.r.acc", "p.r.epoch_0000.loss"] };
    expect(search_selector(state)).toEqual(["p.r.loss", "p.r.epoch_0000.loss"]);
  });
});
