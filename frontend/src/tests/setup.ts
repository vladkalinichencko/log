import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("react-plotly.js", () => ({ default: () => null }));

// vitest's jsdom environment does not expose Storage on the test globals; jsdom keeps it on its own window
const jsdomStorage = (globalThis as { jsdom?: { window?: { localStorage?: Storage } } }).jsdom?.window?.localStorage;
if (typeof localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = jsdomStorage ?? {
    get length() { return store.size; },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);
