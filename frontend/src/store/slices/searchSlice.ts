import type { SetStore } from "../store";

export interface SearchState {
  query: string;
  paths: string[];
}

export const createSearchSlice = (set: SetStore) => ({
  query: "",
  paths: [],

  search_setQuery: (query: string) => set({ query }),
  search_setPaths: (paths: string[]) => set({ paths }),
});
