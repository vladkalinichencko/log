export interface SearchState {
  query: string;
  paths: string[];
}

export const createSearchSlice = (set: any) => ({
  query: "",
  paths: [],

  search_setQuery: (query: string) => set({ query }),
  search_setPaths: (paths: string[]) => set({ paths }),
});
