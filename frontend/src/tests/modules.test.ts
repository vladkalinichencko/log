import { describe, it, expect } from "vitest";

const SOURCES = import.meta.glob<string>("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const TEXT = new Map(Object.entries(SOURCES).map(([path, text]) => [path.startsWith("./") ? `tests/${path.slice(2)}` : path.replace("../", ""), text]));
const files = [...TEXT.keys()];
const modules = [...new Set(files.filter((file) => file.startsWith("modules/")).map((file) => file.split("/")[1]))];

describe("modules", () => {
  it("each module is an index.ts interface whose one export line names its active adapter", () => {
    const found = modules.flatMap((name) => {
      const index = TEXT.get(`modules/${name}/index.ts`);
      if (index === undefined) return [`${name}: no index.ts`];
      const adapters = [...index.matchAll(/^export \{[^}]+\} from\s"\.\/([\w-]+)";$/gm)].map((match) => match[1]);
      if (adapters.length !== 1) return [`${name}: ${adapters.length} export lines`];
      return files.some((file) => file.replace(/\.tsx?$/, "") === `modules/${name}/${adapters[0]}`) ? [] : [`${name}: adapter ${adapters[0]} missing`];
    });
    expect(modules.length).toBeGreaterThan(0);
    expect(found).toEqual([]);
  });

  it("callers import a module only through its index", () => {
    const found = files
      .filter((file) => !file.startsWith("tests/"))
      .flatMap((file) =>
        [...TEXT.get(file)!.matchAll(/from\s"([^"]*modules\/([\w-]+)\/[^"]+)"/g)]
          .filter((match) => !file.startsWith(`modules/${match[2]}/`))
          .map((match) => `${file}: imports ${match[1]}`)
      );
    expect(found).toEqual([]);
  });
});
