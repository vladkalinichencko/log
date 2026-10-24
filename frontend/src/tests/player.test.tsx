import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Tile } from "../components/Tile";
import { useStore } from "../store/store";
import { CellType, Representation, TableKind } from "../types/domain";

const path = "p.r.epoch_0000.w";

afterEach(() => vi.unstubAllGlobals());

describe("tensor player", () => {
  it("loads every frame of a tensor tile into the store and plays them from there", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = url.includes("/steps")
        ? { steps: [0, 1] }
        : { shape: [1, 2], data: url.includes("step=0") ? [1, 2] : [3, 4] };
      return new Response(JSON.stringify(body));
    }));
    useStore.getState().tables_setViews([{
      id: path,
      name: "w",
      kind: TableKind.Grid,
      column_names: null,
      row_names: null,
      cells: [[{ type: CellType.Number, value: "3", ref: null }, { type: CellType.Number, value: "4", ref: null }]],
      representation: Representation.Grid,
      source_path: path,
    }]);
    render(
      <MemoryRouter>
        <Tile path={path} />
      </MemoryRouter>
    );
    expect(await screen.findByTitle("play")).toBeTruthy();
    expect(screen.getByText("step 1")).toBeTruthy();
    expect(useStore.getState().tensors.get(path)?.frames.map((frame) => frame.data)).toEqual([[1, 2], [3, 4]]);
  });
});
