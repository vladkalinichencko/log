import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TableView } from "../components/TableView";
import { row_window_selector } from "../store/selectors/tableViewSelectors";
import { useStore } from "../store/store";
import { CellType, Representation, Table, TableKind } from "../types/domain";

const numbers = (id: string, count: number): Table => ({
  name: id,
  kind: TableKind.Column,
  column_names: ["step", "loss"],
  row_names: null,
  cells: Array.from({ length: count }, (_, row) => [
    { type: CellType.Number, value: String(row), ref: null },
    { type: CellType.Number, value: String(row * 10), ref: null },
  ]),
  representation: Representation.Grid,
  source_path: id,
});

const box = (top: number, height: number, left = 0, width = 300) =>
  ({ top, bottom: top + height, height, left, right: left + width, width, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

let bodyTop = 0;
let scale = 1;

function stubLayout() {
  Object.defineProperty(Element.prototype, "currentCSSZoom", { configurable: true, get: () => scale });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const element = this as HTMLElement;
    if (element.tagName === "TBODY") return box(bodyTop, 30_000 * scale);
    if (element.tagName === "DIV" && element.parentElement?.classList.contains("table-frame")) return box(0, 300);
    if (element.tagName === "TABLE") return box(0, 40 + element.querySelectorAll("tr[data-row]").length * 30);
    if (element.dataset.row !== undefined) {
      const rows = [...element.parentElement!.querySelectorAll("tr[data-row]")];
      return box(40 + rows.indexOf(element) * 30 * scale, 30 * scale);
    }
    if (element.dataset.column !== undefined && element.tagName === "TD") {
      const cells = [...element.parentElement!.querySelectorAll("td[data-column]")];
      return box(0, 30, cells.indexOf(element) * 150, 150);
    }
    return box(0, 0);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (Element.prototype as { currentCSSZoom?: number }).currentCSSZoom;
  bodyTop = 0;
  scale = 1;
});

describe("row windowing", () => {
  it("keeps only the rows around the visible band, with spacers for the rest", () => {
    expect(row_window_selector(Array(1000).fill(30), 0, 300)).toEqual({ from: 0, to: 20, before: 0, after: 980 * 30 });
    expect(row_window_selector(Array(1000).fill(30), 15_000, 15_300)).toEqual({
      from: 490, to: 520, before: 490 * 30, after: 480 * 30,
    });
    expect(row_window_selector([30, 30], 0, 0)).toEqual({ from: 0, to: 2, before: 0, after: 0 });
  });

  it("a long table mounts a window of rows and moves it on scroll", () => {
    stubLayout();
    const { container } = render(<MemoryRouter><TableView table={numbers("long", 1000)} /></MemoryRouter>);
    expect(container.querySelectorAll("tr[data-row]")).toHaveLength(20);
    bodyTop = -15_000;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    const rows = container.querySelectorAll<HTMLElement>("tr[data-row]");
    expect(rows).toHaveLength(30);
    expect(rows[0].dataset.row).toBe("490");
  });

  it("a zoomed table sizes its row window and spacers in unzoomed pixels", () => {
    scale = 2;
    stubLayout();
    const { container } = render(
      <MemoryRouter initialEntries={["/?zoom.zoomed=200"]}>
        <TableView table={numbers("zoomed", 1000)} />
      </MemoryRouter>
    );
    expect(container.querySelector<HTMLElement>("table")!.style.zoom).toBe("2");
    bodyTop = -30_000;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    const rows = container.querySelectorAll<HTMLElement>("tr[data-row]");
    expect(rows[0].dataset.row).toBe("495");
    expect(container.querySelector<HTMLElement>(".row-spacer td")!.style.height).toBe(`${495 * 30}px`);
  });

  it("clicking a row's edge selects that data row even when the table is sorted", () => {
    stubLayout();
    useStore.getState().focus_clear();
    const { container } = render(
      <MemoryRouter initialEntries={["/?sort.sorted=0:desc"]}>
        <TableView table={numbers("sorted", 5)} use="edit" />
      </MemoryRouter>
    );
    fireEvent.click(container.querySelector(".table-frame")!, { clientX: 2, clientY: 50 });
    expect(useStore.getState().focused?.ranges[0]).toMatchObject({ kind: "row", r: 4 });
    fireEvent.click(container.querySelector(".table-frame")!, { clientX: 160, clientY: 2 });
    expect(useStore.getState().focused?.ranges[0]).toMatchObject({ kind: "col", c: 1 });
  });
});
