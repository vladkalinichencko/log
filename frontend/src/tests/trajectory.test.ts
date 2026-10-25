import { describe, it, expect } from "vitest";
import { applicable, TRAJECTORY_COLUMNS } from "../components/render";
import { chartSpec } from "../modules/chart/plotly";
import { frameTable, trajectoryTable } from "../components/Player";
import { functionExpression } from "../components/Toolbar";
import { Representation } from "../types/domain";

const frames = [
  { shape: [2, 2], data: [0, 0, 10, 10] },
  { shape: [2, 2], data: [1, 1, 11, 11] },
];

describe("trajectoryTable", () => {
  it("stacks frames up to the index as (step, point, x, y) rows", () => {
    const t = trajectoryTable("t", "tile", [49, 99], frames, 1);
    expect(t.column_names).toEqual(TRAJECTORY_COLUMNS);
    expect(t.cells.map((row) => row.map((cell) => cell.value))).toEqual([
      ["49", "0", "0", "0"],
      ["49", "1", "10", "10"],
      ["99", "0", "1", "1"],
      ["99", "1", "11", "11"],
    ]);
  });

  it("cut at index 0 holds only the first frame", () => {
    expect(trajectoryTable("t", "tile", [49, 99], frames, 0).cells.length).toBe(2);
  });
});

describe("applicable for points and trajectories", () => {
  it("offers scatter for a numeric N×2 grid", () => {
    const t = frameTable("f", "tile", frames[0]);
    expect(applicable(t)).toEqual([Representation.Grid, Representation.Scatter, Representation.Heatmap]);
  });

  it("offers trajectory for the stacked (step, point, x, y) table", () => {
    const t = trajectoryTable("t", "tile", [49, 99], frames, 1);
    expect(applicable(t)).toEqual([Representation.Grid, Representation.Trajectory]);
  });
});

describe("chartSpec trajectory", () => {
  it("draws one muted trail per point and a head marker at the last step", () => {
    const t = trajectoryTable("t", "tile", [49, 99], frames, 1);
    const spec = chartSpec(t, Representation.Trajectory);
    const [trail, head] = spec.data as any[];
    expect(trail.x).toEqual([0, 1, null, 10, 11, null]);
    expect(head.x).toEqual([1, 11]);
    expect(head.y).toEqual([1, 11]);
  });
});

describe("functionExpression", () => {
  it("builds a derive over the target column", () => {
    expect(functionExpression({ name: "mean", kind: "aggregation", windowed: false }, "loss")).toBe(
      "derive(mean_loss = mean(loss))"
    );
    expect(functionExpression({ name: "zscore", kind: "transform", windowed: true }, "loss")).toBe(
      "derive(zscore_loss = zscore(loss, 20))"
    );
  });
});
