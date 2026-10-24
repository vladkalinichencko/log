import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("refetches frames when a closed tile is reopened after the run logged more steps", async () => {
    let steps = [0];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = url.includes("/steps") ? { steps } : { shape: [1, 2], data: [0, 0] };
      return new Response(JSON.stringify(body));
    }));
    const tile = (
      <MemoryRouter>
        <Tile path={path} />
      </MemoryRouter>
    );
    const first = render(tile);
    await waitFor(() => expect(useStore.getState().tensors.get(path)?.steps).toEqual([0]));
    first.unmount();
    steps = [0, 1, 2];
    render(tile);
    expect(await screen.findByText("step 2")).toBeTruthy();
  });

  it("refetches frames on a live update and keeps following the newest step", async () => {
    let steps = [0, 1];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = url.includes("/steps") ? { steps } : { shape: [1, 2], data: [0, 0] };
      return new Response(JSON.stringify(body));
    }));
    render(
      <MemoryRouter>
        <Tile path={path} />
      </MemoryRouter>
    );
    await waitFor(() => expect(useStore.getState().tensors.get(path)?.steps).toEqual([0, 1]));
    steps = [0, 1, 2, 3];
    act(() => useStore.getState().connection_bump());
    await waitFor(() => expect(useStore.getState().tensors.get(path)?.steps).toEqual([0, 1, 2, 3]));
    expect(await screen.findByText("step 3")).toBeTruthy();
  });
});
