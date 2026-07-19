import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Modal } from "../components/Modal";

describe("Modal", () => {
  it("is hidden without a modal param", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/x"]}>
        <Modal />
      </MemoryRouter>
    );
    expect(container.querySelector(".modal")).toBeNull();
  });

  it("opens fullscreen when ?modal= is set", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/x?modal=p.r"]}>
        <Modal />
      </MemoryRouter>
    );
    expect(container.querySelector(".modal")).toBeTruthy();
  });
});
