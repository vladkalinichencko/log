import { Representation } from "../../types/domain";

export interface TilesState {
  tiles: Map<string, { representation: Representation }>;
  pinned: string[];
}

export const createTilesSlice = (set: any) => ({
  tiles: new Map<string, { representation: Representation }>(),
  pinned: [],

  tiles_setRepresentation: (tileId: string, representation: Representation) =>
    set((state: any) => ({
      tiles: new Map(state.tiles).set(tileId, { representation }),
    })),

  tiles_pin: (path: string) =>
    set((state: any) =>
      state.pinned.includes(path) ? {} : { pinned: [...state.pinned, path] }
    ),

  tiles_unpin: (path: string) =>
    set((state: any) => ({ pinned: state.pinned.filter((p: string) => p !== path) })),

  tiles_loadWorkspace: (workspace: any) =>
    set((state: any) => {
      const tiles = new Map(state.tiles);
      for (const tile of workspace.tiles) {
        if (tile.representation) tiles.set(tile.table_path, { representation: tile.representation });
      }
      return { pinned: workspace.tiles.map((tile: any) => tile.table_path), tiles };
    }),
});
