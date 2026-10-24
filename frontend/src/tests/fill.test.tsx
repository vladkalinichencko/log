import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TableView } from "../components/TableView";
import { fill_values } from "../store/slices/tablesSlice";
import { fill_target_selector } from "../store/selectors/tableSelectors";
import { useStore } from "../store/store";
import { CellType, Representation, Table, TableKind } from "../types/domain";

describe("fill", () => {
  it("continues an even numeric step and repeats anything else", () => {
    expect(fill_values(["1", "2"], 3)).toEqual(["3", "4", "5"]);
    expect(fill_values(["0.1", "0.2", "0.3"], 2)).toEqual(["0.4", "0.5"]);
    expect(fill_values(["7"], 2)).toEqual(["7", "7"]);
    expect(fill_values(["a", "b"], 3)).toEqual(["a", "b", "a"]);
    expect(fill_values(["1", "4", "5"], 2)).toEqual(["1", "4"]);
  });

  it("fills in the dominant drag direction only, any of the four", () => {
    const source = { top: 2, bottom: 3, left: 2, right: 2 };
    expect(fill_target_selector(source, { r: 6, c: 3 })).toEqual({ top: 2, bottom: 6, left: 2, right: 2 });
    expect(fill_target_selector(source, { r: 3, c: 5 })).toEqual({ top: 2, bottom: 3, left: 2, right: 5 });
    expect(fill_target_selector(source, { r: 0, c: 2 })).toEqual({ top: 0, bottom: 3, left: 2, right: 2 });
    expect(fill_target_selector(source, { r: 2, c: 0 })).toEqual({ top: 2, bottom: 3, left: 0, right: 2 });
    expect(fill_target_selector(source, { r: 3, c: 2 })).toBeNull();
  });

  it("filling up or left continues the series backwards and repeats in reverse", () => {
    const value = (text: string) => ({ type: CellType.String, value: text, ref: null });
    const store = useStore.getState;
    store().tables_loadTable("back", {
      name: "back",
      kind: TableKind.Grid,
      column_names: null,
      row_names: null,
      cells: [["", "", "", ""], ["", "", "", ""], ["", "", "3", "a"], ["", "", "4", "b"]].map((row) => row.map(value)),
      representation: Representation.Grid,
      source_path: "back",
    });
    store().tables_fill("back", { top: 2, bottom: 3, left: 2, right: 3 }, { top: 0, bottom: 3, left: 2, right: 3 });
    expect(store().tables.get("back")!.cells.map((row) => row.slice(2).map((cell) => cell.value))).toEqual([
      ["1", "a"], ["2", "b"], ["3", "a"], ["4", "b"],
    ]);
    store().tables_fill("back", { top: 2, bottom: 2, left: 2, right: 3 }, { top: 2, bottom: 2, left: 0, right: 3 });
    expect(store().tables.get("back")!.cells[2].map((cell) => cell.value)).toEqual(["3", "a", "3", "a"]);
  });

  it("dragging the fill handle down extends the series as one undoable edit", () => {
    const value = (text: string) => ({ type: text ? CellType.Number : CellType.Empty, value: text, ref: null });
    const table: Table = {
      name: "fill",
      kind: TableKind.Column,
      column_names: ["step"],
      row_names: null,
      cells: [["1"], ["2"], [""], [""]].map((row) => row.map(value)),
      representation: Representation.Grid,
      source_path: "fill",
    };
    const store = useStore.getState;
    store().tables_loadTable("fill", table);
    store().focus_clear();
    const view = () => render(<MemoryRouter><TableView table={store().tables.get("fill")!} editable /></MemoryRouter>);
    const { unmount } = view();
    fireEvent.mouseDown(screen.getByText("1"));
    fireEvent.mouseEnter(screen.getByText("2"));
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(screen.getByTitle("Drag to fill in any direction"));
    const cells = document.querySelectorAll("td[data-column='0'] .cell");
    fireEvent.mouseEnter(cells[3]);
    fireEvent.mouseUp(window);
    unmount();
    expect(store().tables.get("fill")!.cells.map((row) => row[0].value)).toEqual(["1", "2", "3", "4"]);
    store().tables_undo();
    expect(store().tables.get("fill")!.cells.map((row) => row[0].value)).toEqual(["1", "2", "", ""]);
  });
});
