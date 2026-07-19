import { create } from "zustand";
import { createTablesSlice } from "./slices/tablesSlice";
import { createTilesSlice } from "./slices/tilesSlice";
import { createSearchSlice } from "./slices/searchSlice";
import { createFocusSlice } from "./slices/focusSlice";
import { createConnectionSlice } from "./slices/connectionSlice";
import { createSettingsSlice } from "./slices/settingsSlice";

export const useStore = create((set) => ({
  ...createTablesSlice(set),
  ...createTilesSlice(set),
  ...createSearchSlice(set),
  ...createFocusSlice(set),
  ...createConnectionSlice(set),
  ...createSettingsSlice(set),
}));
