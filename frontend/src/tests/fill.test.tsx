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

  it("fills in the dominant drag direction only", () => {
    const source = { top: 0, bottom: 1, left: 0, right: 0 };
    expect(fill_target_selector(source, { r: 4, c: 1 })).toEqual({ top: 0, bottom: 4, left: 0, right: 0 });
    expect(fill_target_selector(source, { r: 1, c: 3 })).toEqual({ top: 0, bottom: 1, left: 0, right: 3 });
    expect(fill_target_selector(source, { r: 0, c: 0 })).toBeNull();
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
    fireEvent.mouseDown(screen.getByTitle("Drag to fill down or right"));
    const cells = document.querySelectorAll("td[data-column='0'] .cell");
    fireEvent.mouseEnter(cells[3]);
    fireEvent.mouseUp(window);
    unmount();
    expect(store().tables.get("fill")!.cells.map((row) => row[0].value)).toEqual(["1", "2", "3", "4"]);
    store().tables_undo();
    expect(store().tables.get("fill")!.cells.map((row) => row[0].value)).toEqual(["1", "2", "", ""]);
  });
});
