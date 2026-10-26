import type { StoreData } from "../store";

export function search_selector(state: Pick<StoreData, "query" | "paths">): string[] {
  const query = state.query.trim();
  if (!query) return [];
  return state.paths.filter((path) => path.includes(query));
}

export function formula_selector(
  state: Pick<StoreData, "functions" | "paths">,
  expression: string,
  columns: string[]
): { word: string; suggestions: string[] } {
  const word = expression.match(/[A-Za-z_][\w.]*$/)?.[0] ?? "";
  if (!word) return { word, suggestions: [] };
  const names = [...columns, ...state.functions.map((fn) => fn.name), ...state.paths];
  return {
    word,
    suggestions: names.filter((name) => name.startsWith(word) && name !== word).slice(0, 8),
  };
}

export const formula_name = (name: string) => (/^[\w.]+$/.test(name) ? name : `"${name}"`);
