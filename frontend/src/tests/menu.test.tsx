import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Menu } from "../components/Menu";

it("renders menus in the document popup layer", () => {
  render(
    <div style={{ overflow: "hidden" }}>
      <button>open</button>
      <Menu items={[{ label: "choice", onPick: () => {} }]} />
    </div>
  );
  expect(screen.getByText("choice").closest(".menu")?.parentElement).toBe(document.body);
});
