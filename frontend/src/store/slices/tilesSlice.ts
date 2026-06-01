import { Representation } from "../../types/domain";

interface TileRecord {
  representation?: Representation;
  w?: number;
  h?: number;
}

export interface TilesState {
  tiles: Map<string, TileRecord>;
  pinned: string[];
}

const DEFAULT_W = 400;
const DEFAULT_H = 300;
const MIN_W = 100;
const MIN_H = 80;

export const createTilesSlice = (set: any) => ({
  tiles: new Map<string, TileRecord>(),
  pinned: [],

  tiles_setRepresentation: (tileId: string, representation: Representation) =>
    set((state: any) => {
      const tiles = new Map<string, TileRecord>(state.tiles);
      tiles.set(tileId, { ...tiles.get(tileId), representation });
      return { tiles };
    }),

  tiles_resize: (tileId: string, dw: number, dh: number) =>
    set((state: any) => {
      const tiles = new Map<string, TileRecord>(state.tiles);
      const tile = tiles.get(tileId) ?? {};
      tiles.set(tileId, {
        ...tile,
        w: Math.max(MIN_W, (tile.w ?? DEFAULT_W) + dw),
        h: Math.max(MIN_H, (tile.h ?? DEFAULT_H) + dh),
      });
      return { tiles };
    }),

  tiles_pin: (path: string) =>
    set((state: any) =>
      state.pinned.includes(path) ? {} : { pinned: [...state.pinned, path] }
    ),

  tiles_unpin: (path: string) =>
    set((state: any) => ({ pinned: state.pinned.filter((p: string) => p !== path) })),

  tiles_loadWorkspace: (workspace: any) =>
    set((state: any) => {
      const tiles = new Map<string, TileRecord>(state.tiles);
      for (const tile of workspace.tiles) {
        tiles.set(tile.table_path, {
          ...tiles.get(tile.table_path),
          representation: tile.representation,
          w: tile.w,
          h: tile.h,
        });
      }
      return { pinned: workspace.tiles.map((tile: any) => tile.table_path), tiles };
    }),
});
