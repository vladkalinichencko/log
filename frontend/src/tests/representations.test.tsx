import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RepresentationSwitcher } from "../components/RepresentationSwitcher";
import { chartSpec } from "../components/chartSpec";
import { applicable } from "../components/render";
import { useStore } from "../store/store";
import { Table, Cell, CellType, TableKind, Representation } from "../types/domain";

const num = (v: string): Cell => ({ type: CellType.Number, value: v, ref: null });

function table(kind: TableKind, rep: Representation, cells: Cell[][], cols: string[] | null = null): Table {
  return { name: "t", kind, column_names: cols, row_names: null, cells, representation: rep, source_path: null };
}

describe("representations", () => {
  it("chartSpec(line) maps step→x and the last column→y", () => {
    const series = table(
      TableKind.Column,
      Representation.Line,
      [
        [num("0"), num("0"), num("1"), num("0"), num("2")],
        [num("1"), num("0"), num("2"), num("0"), num("1")],
      ],
      ["step", "samples_seen", "wall_time", "rank", "loss"]
    );
    const trace = chartSpec(series, "line").data[0] as any;
    expect(trace.type).toBe("scatter");
    expect(trace.x).toEqual([0, 1]);
    expect(trace.y).toEqual([2, 1]);
  });

  it("chartSpec(heatmap) maps the grid to z", () => {
    const grid = table(TableKind.Grid, Representation.Heatmap, [
      [num("0"), num("1")],
      [num("2"), num("3")],
    ]);
    const trace = chartSpec(grid, "heatmap").data[0] as any;
    expect(trace.type).toBe("heatmap");
    expect(trace.z).toEqual([[0, 1], [2, 3]]);
  });

  it("applicable derives representations from table shape", () => {
    const col = table(TableKind.Column, Representation.Line, [[num("1")]]);
    expect(applicable(col)).toContain(Representation.Line);
    const grid = table(TableKind.Grid, Representation.Grid, [[num("1")]]);
    expect(applicable(grid)).toContain(Representation.Heatmap);
  });

  it("chartSpec(histogram) maps the last column to x", () => {
    const series = table(
      TableKind.Column,
      Representation.Histogram,
      [[num("0"), num("1")], [num("1"), num("5")], [num("2"), num("9")]],
      ["step", "loss"]
    );
    const trace = chartSpec(series, "histogram").data[0] as any;
    expect(trace.type).toBe("histogram");
    expect(trace.x).toEqual([1, 5, 9]);
  });

  it("applicable offers histogram for a numeric series", () => {
    const col = table(TableKind.Column, Representation.Line, [[num("1")]], ["loss"]);
    expect(applicable(col)).toContain(Representation.Histogram);
  });

  it("switcher toggle sets the tile mode", () => {
    const s = () => useStore.getState() as any;
    const col = table(TableKind.Column, Representation.Line, [[num("1")]]);
    render(<RepresentationSwitcher table={col} tileId="t1" />);
    fireEvent.click(screen.getByTitle("visualization"));
    expect(s().tiles.get("t1").mode).toBe("visualization");
    fireEvent.click(screen.getByTitle("table"));
    expect(s().tiles.get("t1").mode).toBe("table");
  });

  it("switcher visualization mode picks a chart via the dropdown", () => {
    const s = () => useStore.getState() as any;
    const col = table(TableKind.Column, Representation.Line, [[num("1")]], ["loss"]);
    render(<RepresentationSwitcher table={col} tileId="t2" />);
    fireEvent.click(screen.getByTitle("visualization"));
    expect(s().tiles.get("t2").mode).toBe("visualization");
    fireEvent.click(screen.getByTitle("chart type"));
    fireEvent.click(screen.getByText("histogram"));
    expect(s().tiles.get("t2").representation).toBe("histogram");
  });
});
