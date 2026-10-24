import { fireEvent, render, screen } from "@testing-library/react";
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

it("exposes list menus as a menu of menuitems and Enter picks the active one", () => {
  let picked = "";
  render(<Menu items={["first", "second"].map((label) => ({ label, onPick: () => (picked = label) }))} />);
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["first", "second"]);
  fireEvent.keyDown(window, { key: "ArrowDown" });
  fireEvent.keyDown(window, { key: "ArrowDown" });
  fireEvent.keyDown(window, { key: "Enter" });
  expect(picked).toBe("second");
});
