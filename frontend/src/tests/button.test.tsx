import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Button } from "../components/Button";

describe("Button", () => {
  it("renders hover from its FSM and shows a failed async action as error", async () => {
    let reject: (error: Error) => void = () => {};
    render(<Button label="save" onClick={() => new Promise((_, fail) => (reject = fail))} />);
    const button = screen.getByText("save");
    fireEvent.mouseEnter(button);
    expect(button.dataset.state).toBe("hover");
    fireEvent.click(button);
    expect(button.dataset.state).toBe("pending");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    reject(new Error("disk full"));
    await waitFor(() => expect(button.dataset.state).toBe("error"));
  });
});
