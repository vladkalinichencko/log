export interface SearchState {
  query: string;
}

export const createSearchSlice = (set: any) => ({
  query: "",

  search_setQuery: (query: string) => set({ query }),
});
