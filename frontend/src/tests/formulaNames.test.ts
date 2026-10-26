import { describe, it, expect } from "vitest";
import { functionExpression } from "../components/Toolbar";

describe("formula names", () => {
  it("a statistic on a plain column stays unquoted, on a path-style column or the pick placeholder it is quoted", () => {
    const zscore = { name: "zscore", kind: "transform" as const, windowed: true };
    expect(functionExpression(zscore, "loss")).toBe("derive(zscore_loss = zscore(loss, 20))");
    expect(functionExpression(zscore, "train/loss")).toBe('derive("zscore_train/loss" = zscore("train/loss", 20))');
    expect(functionExpression(zscore, "«col»")).toBe('derive("zscore_«col»" = zscore("«col»", 20))');
  });
});
