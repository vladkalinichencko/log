import { describe, expect, it } from "vitest";
import {
  parse_sorts,
  parse_widths,
  serialize_sorts,
  serialize_widths,
  table_view_selector,
} from "../store/selectors/tableViewSelectors";
import { CellType, Representation, Table, TableKind } from "../types/domain";

const table: Table = {
  name: "runs",
  kind: TableKind.Folder,
  column_names: ["run", "status", "samples"],
  row_names: null,
  cells: [
    [
      { type: CellType.String, value: "baseline", ref: null },
      { type: CellType.String, value: "finished", ref: null },
      { type: CellType.Number, value: "20", ref: null },
    ],
    [
      { type: CellType.String, value: "high_lr", ref: null },
      { type: CellType.String, value: "running", ref: null },
      { type: CellType.Number, value: "5", ref: null },
    ],
    [
      { type: CellType.String, value: "long_run", ref: null },
      { type: CellType.String, value: "finished", ref: null },
      { type: CellType.Number, value: "100", ref: null },
    ],
  ],
  representation: Representation.Grid,
  source_path: "demo",
};

describe("table_view_selector", () => {
  it("ANDs typed filters and supports a whole-row substring", () => {
    expect(table_view_selector(table, "status=finished, samples>=50", []).rows.map((row) => row.index))
      .toEqual([2]);
    expect(table_view_selector(table, "high", []).rows.map((row) => row.index)).toEqual([1]);
  });

  it("keeps rows visible and reports an invalid filter", () => {
    const view = table_view_selector(table, "samples~10", []);
    expect(view.rows).toHaveLength(3);
    expect(view.error).toBe("~ is only valid for text columns");
  });

  it("applies ordered multi-sort without changing the source table", () => {
    const view = table_view_selector(table, "", [
      { column: 1, direction: "asc" },
      { column: 2, direction: "desc" },
    ]);
    expect(view.rows.map((row) => row.index)).toEqual([2, 0, 1]);
    expect(table.cells[0][0].value).toBe("baseline");
  });

  it("round-trips URL sort and width state", () => {
    const sorts = [{ column: 0, direction: "asc" as const }, { column: 2, direction: "desc" as const }];
    expect(parse_sorts(serialize_sorts(sorts))).toEqual(sorts);
    expect(parse_widths(serialize_widths({ 0: 140, 2: 220 }))).toEqual({ 0: 140, 2: 220 });
  });
});
