export function search_selector(state: any): string[] {
  const query: string = state.searchQuery ?? "";
  // v0: the `.`-path index arrives in v1; with no query there is nothing to match.
  return query ? [] : [];
}
