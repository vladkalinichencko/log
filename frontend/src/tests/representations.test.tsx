import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LineChartView } from "../components/LineChartView";
import { HeatmapView } from "../components/HeatmapView";
import { HistogramView } from "../components/HistogramView";
import { ListView } from "../components/ListView";
import { RepresentationSwitcher } from "../components/RepresentationSwitcher";
import { applicable } from "../components/render";
import { useStore } from "../store/store";
import { Table, Cell, CellType, TableKind, Representation } from "../types/domain";

const num = (v: string): Cell => ({ type: CellType.Number, value: v, ref: null });

function table(kind: TableKind, rep: Representation, cells: Cell[][], cols: string[] | null = null): Table {
  return { name: "t", kind, column_names: cols, row_names: null, cells, representation: rep, source_path: null };
}

describe("representations", () => {
  it("line view draws one polyline point per row", () => {
    const series = table(
      TableKind.Column,
      Representation.Line,
      [
        [num("0"), num("0"), num("1"), num("0"), num("2")],
        [num("1"), num("0"), num("2"), num("0"), num("1")],
      ],
      ["step", "samples_seen", "wall_time", "rank", "loss"]
    );
    const { container } = render(<LineChartView table={series} />);
    const poly = container.querySelector("polyline");
    expect(poly).toBeTruthy();
    expect(poly!.getAttribute("points")!.trim().split(" ").length).toBe(2);
  });

  it("heatmap draws one rect per cell", () => {
    const grid = table(TableKind.Grid, Representation.Heatmap, [
      [num("0"), num("1")],
      [num("2"), num("3")],
    ]);
    const { container } = render(<HeatmapView table={grid} />);
    expect(container.querySelectorAll("rect").length).toBe(4);
  });

  it("list view renders each cell value", () => {
    const folder = table(TableKind.Folder, Representation.List, [
      [{ type: CellType.TableRef, value: "proj", ref: "proj" }],
    ]);
    render(
      <MemoryRouter>
        <ListView table={folder} />
      </MemoryRouter>
    );
    expect(screen.getByText("proj")).toBeTruthy();
  });

  it("applicable derives representations from table shape", () => {
    const col = table(TableKind.Column, Representation.Line, [[num("1")]]);
    expect(applicable(col)).toContain(Representation.Line);
    const grid = table(TableKind.Grid, Representation.Grid, [[num("1")]]);
    expect(applicable(grid)).toContain(Representation.Heatmap);
  });

  it("histogram draws one bar per bin", () => {
    const series = table(
      TableKind.Column,
      Representation.Histogram,
      [[num("0"), num("1")], [num("1"), num("5")], [num("2"), num("9")]],
      ["step", "loss"]
    );
    const { container } = render(<HistogramView table={series} />);
    expect(container.querySelectorAll("rect").length).toBe(10);
  });

  it("applicable offers histogram for a numeric series", () => {
    const col = table(TableKind.Column, Representation.Line, [[num("1")]], ["loss"]);
    expect(applicable(col)).toContain(Representation.Histogram);
  });

  it("switcher sets the tile representation on click", () => {
    const col = table(TableKind.Column, Representation.Line, [[num("1")]]);
    render(<RepresentationSwitcher table={col} tileId="t1" />);
    fireEvent.click(screen.getByText("grid"));
    expect((useStore.getState() as any).tiles.get("t1").representation).toBe("grid");
  });

  it("switcher visualization mode picks a chart via the dropdown", () => {
    const s = () => useStore.getState() as any;
    const col = table(TableKind.Column, Representation.Line, [[num("1")]], ["loss"]);
    render(<RepresentationSwitcher table={col} tileId="t2" />);
    fireEvent.click(screen.getByText("visualization"));
    expect(s().tiles.get("t2").mode).toBe("visualization");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "line" } });
    expect(s().tiles.get("t2").representation).toBe("line");
  });
});
