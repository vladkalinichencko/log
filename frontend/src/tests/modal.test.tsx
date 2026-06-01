import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Modal } from "../components/Modal";

describe("Modal", () => {
  it("is hidden without a modal param", () => {
    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Modal />
      </MemoryRouter>
    );
    expect(screen.queryByText("close")).toBeNull();
  });

  it("opens fullscreen when ?modal= is set", () => {
    render(
      <MemoryRouter initialEntries={["/x?modal=p.r"]}>
        <Modal />
      </MemoryRouter>
    );
    expect(screen.getByText("close")).toBeTruthy();
  });
});
