import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("react-plotly.js", () => ({ default: () => null }));

Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);
