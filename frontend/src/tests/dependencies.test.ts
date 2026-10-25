import { describe, it, expect } from "vitest";

const SOURCES = import.meta.glob<string>("../**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true });
const PLATFORM = ["react", "react-dom", "react-router-dom", "vitest", "@testing-library/react"];
const ADAPTERS: Record<string, string[]> = {
  "plotly.js": ["modules/chart/plotly.tsx", "modules/chart/plotly-dist.d.ts"],
  "react-plotly.js": ["modules/chart/plotly.tsx"],
  zustand: ["store/store.ts"],
  "@fontsource/ibm-plex-mono": ["styles/tokens.css"],
};

const imports = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|@import\s+)"([^".][^"]*)"/g)].map((match) => match[1]);

const owner = (specifier: string) =>
  Object.keys(ADAPTERS).find((name) => specifier === name || specifier.startsWith(`${name}/`));

describe("dependencies", () => {
  it("imports every capability library only from its one adapter, and nothing unregistered", () => {
    const found: string[] = [];
    for (const [path, text] of Object.entries(SOURCES)) {
      const file = path.replace("../", "");
      for (const specifier of imports(text)) {
        if (PLATFORM.some((name) => specifier === name || specifier.startsWith(`${name}/`))) continue;
        const library = owner(specifier);
        if (!library) found.push(`${file}: unregistered dependency ${specifier}`);
        else if (!ADAPTERS[library].includes(file)) found.push(`${file}: imports ${specifier} outside its adapter`);
      }
    }
    expect(found).toEqual([]);
  });
});
