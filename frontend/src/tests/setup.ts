import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("react-plotly.js", () => ({ default: () => null }));

afterEach(cleanup);
