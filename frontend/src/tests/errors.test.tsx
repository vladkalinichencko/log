import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Tile } from "../components/Tile";
import { Button } from "../components/Button";
import { Notices, attempt } from "../components/Notices";
import { fetchTable } from "../api/client";
import { useStore } from "../store/store";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  useStore.setState({ notices: [] });
});

describe("errors reach the screen", () => {
  it("a tile that fails to load shows the server message and Retry loads it", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async () =>
      fail
        ? json({ error: { code: "TABLE_NOT_FOUND", message: "Run p.gone not found" } }, 404)
        : json({ name: "back", kind: "column", column_names: ["a"], row_names: null, cells: [], representation: "grid", source_path: "p.gone" })
    ));
    render(<MemoryRouter><Tile path="p.gone" titled /></MemoryRouter>);
    expect(await screen.findByText("Run p.gone not found")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByText("Retry"));
    expect(await screen.findByText("back")).toBeTruthy();
  });

  it("a failed async button action shows its message and Retry runs it again", async () => {
    const action = vi.fn(() => Promise.reject(new Error("disk full")));
    render(<><Button label="save" onClick={action} /><Notices /></>);
    fireEvent.click(screen.getByText("save"));
    expect(await screen.findByText("save: disk full")).toBeTruthy();
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it("a failed background job becomes a notice whose Retry repeats the job", async () => {
    const work = vi.fn(() => Promise.reject(new Error("offline")));
    render(<Notices />);
    attempt("saved views", work);
    expect(await screen.findByText("saved views: offline")).toBeTruthy();
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(work).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByTitle("dismiss"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a non-JSON answer is reported as such instead of a parser error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" })));
    await expect(fetchTable("p")).rejects.toThrow("502 Bad Gateway: /api/table?path=p did not answer JSON");
  });
});
