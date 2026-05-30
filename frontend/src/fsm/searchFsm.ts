import { makeFsm } from "./baseFsm";

type SearchState = "empty" | "typing" | "results" | "noResults";
type SearchEvent = "input" | "found" | "notFound" | "clear";

export const searchFsm = makeFsm<SearchState, SearchEvent>(
  ["empty", "typing", "results", "noResults"],
  {
    empty: { input: "typing" },
    typing: { found: "results", notFound: "noResults", clear: "empty" },
    results: { input: "typing", clear: "empty" },
    noResults: { input: "typing", clear: "empty" },
  },
);
