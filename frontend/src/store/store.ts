import { create } from "zustand";
import { createTablesSlice } from "./slices/tablesSlice";
import { createRouteSlice } from "./slices/routeSlice";
import { createTilesSlice } from "./slices/tilesSlice";
import { createSearchSlice } from "./slices/searchSlice";
import { createFocusSlice } from "./slices/focusSlice";
import { createConnectionSlice } from "./slices/connectionSlice";

export const useStore = create((set) => ({
  ...createTablesSlice(set),
  ...createRouteSlice(set),
  ...createTilesSlice(set),
  ...createSearchSlice(set),
  ...createFocusSlice(set),
  ...createConnectionSlice(set),
}));
