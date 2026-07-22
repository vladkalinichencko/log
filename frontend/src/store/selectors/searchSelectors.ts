export function search_selector(state: any): string[] {
  const query = state.query.trim();
  if (!query) return [];
  return state.paths.filter((path: string) => path.includes(query));
}

export function formula_selector(
  state: any,
  expression: string,
  columns: string[]
): { word: string; suggestions: string[] } {
  const word = expression.match(/[A-Za-z_][\w.]*$/)?.[0] ?? "";
  if (!word) return { word, suggestions: [] };
  const names = [...columns, ...state.functions.map((fn: any) => fn.name), ...state.paths];
  return {
    word,
    suggestions: names.filter((name) => name.startsWith(word) && name !== word).slice(0, 8),
  };
}
