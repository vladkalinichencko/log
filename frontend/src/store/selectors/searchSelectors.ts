export function search_selector(state: any): string[] {
  const query = state.query.trim();
  if (!query) return [];
  return state.paths.filter((path: string) => path.includes(query));
}
