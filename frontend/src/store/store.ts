import { create } from "zustand";
import { createTablesSlice, TablesState } from "./slices/tablesSlice";
import { createTilesSlice, TilesState } from "./slices/tilesSlice";
import { createSearchSlice, SearchState } from "./slices/searchSlice";
import { createFocusSlice, FocusState } from "./slices/focusSlice";
import { createConnectionSlice, ConnectionState } from "./slices/connectionSlice";
import { createSettingsSlice, SettingsState } from "./slices/settingsSlice";
import { createNoticesSlice, NoticesState } from "./slices/noticesSlice";
import { createProjectsSlice, ProjectsState } from "./slices/projectsSlice";

export type StoreData = TablesState & TilesState & SearchState & FocusState & ConnectionState & SettingsState & NoticesState & ProjectsState;

export type SetStore = (change: Partial<StoreData> | ((state: StoreData) => Partial<StoreData>)) => void;

type Actions<Slice extends (set: SetStore) => object> = Omit<ReturnType<Slice>, keyof StoreData>;

export type Store = StoreData &
  Actions<typeof createTablesSlice> &
  Actions<typeof createTilesSlice> &
  Actions<typeof createSearchSlice> &
  Actions<typeof createFocusSlice> &
  Actions<typeof createConnectionSlice> &
  Actions<typeof createSettingsSlice> &
  Actions<typeof createNoticesSlice> &
  Actions<typeof createProjectsSlice>;

export const useStore = create<Store>()((set) => ({
  ...createTablesSlice(set),
  ...createTilesSlice(set),
  ...createSearchSlice(set),
  ...createFocusSlice(set),
  ...createConnectionSlice(set),
  ...createSettingsSlice(set),
  ...createNoticesSlice(set),
  ...createProjectsSlice(set),
}));
