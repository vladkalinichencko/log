import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainView } from "../components/MainView";
import { Settings } from "../components/Settings";
import { useStore } from "../store/store";
import { Cell, CellType, Representation, Table, TableKind } from "../types/domain";

const number = (value: string): Cell => ({ type: CellType.Number, value, ref: null });
const text = (value: string): Cell => ({ type: CellType.String, value, ref: null });
const table = (source_path: string, kind: TableKind, column_names: string[] | null, cells: Cell[][]): Table => ({
  name: source_path.split(".").pop()!, kind, column_names, row_names: null, cells, representation: Representation.Grid, source_path,
});

const saved: unknown[] = [];

function stubSettingsApi() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") saved.push(JSON.parse(String(init.body)));
    const body = init?.method === "PUT"
      ? { alerts: { non_finite: true, spike: true, stall: true, heartbeat: true }, ...JSON.parse(String(init.body)) }
      : { hero: null, alerts: { non_finite: true, spike: true, stall: true, heartbeat: true } };
    return new Response(JSON.stringify(url.includes("/settings") ? body : {}), { status: 200 });
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  saved.length = 0;
  useStore.setState({ projects: new Map() });
});

describe("project settings", () => {
  it("the run page draws one hero metric, loss by default, and picking another saves it for the project", async () => {
    stubSettingsApi();
    const run = table("hp.base", TableKind.Folder, null, [
      [{ type: CellType.TableRef, value: "meta", ref: "hp.base.meta" }],
      [{ type: CellType.TableRef, value: "metrics", ref: "hp.base.metrics" }],
    ]);
    const meta = table("hp.base.meta", TableKind.Column, ["key", "value"], [[text("status"), text("finished")]]);
    const metrics = table("hp.base.metrics", TableKind.Grid, ["step", "epoch", "wall_time", "rank", "acc", "loss"], [
      ["0", "0", "1", "0", "0.1", "2"].map(number), ["1", "0", "2", "0", "0.4", "1"].map(number),
    ]);
    useStore.getState().tables_setViews([run, meta, metrics].map((view) => ({ ...view, id: view.source_path! })));
    render(<MemoryRouter><MainView path="hp.base" /></MemoryRouter>);
    const picker = await screen.findByTitle("Main chart metric for every run of this project");
    expect(picker.textContent).toBe("loss ▾");
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole("menuitem", { name: "acc" }));
    await waitFor(() => expect(screen.getByTitle("Main chart metric for every run of this project").textContent).toBe("acc ▾"));
    expect(saved).toEqual([expect.objectContaining({ hero: "acc" })]);
  });

  it("settings switch a built-in alert off for the current project", async () => {
    stubSettingsApi();
    render(<MemoryRouter initialEntries={["/hp.base"]}><Settings /></MemoryRouter>);
    const spike = (await screen.findByLabelText("a metric jumps far outside its recent range")) as HTMLInputElement;
    await waitFor(() => expect(spike.disabled).toBe(false));
    expect(spike.checked).toBe(true);
    fireEvent.click(spike);
    await waitFor(() => expect(spike.checked).toBe(false));
    expect(saved).toEqual([expect.objectContaining({ alerts: expect.objectContaining({ spike: false }) })]);
  });
});
