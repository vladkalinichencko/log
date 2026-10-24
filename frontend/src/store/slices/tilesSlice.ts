import { Representation, TileMode, Workspace } from "../../types/domain";
import type { SetStore, StoreData } from "../store";

export interface TileRecord {
  mode?: TileMode;
  representation?: Representation;
  w?: number;
  h?: number;
}

export interface TilesState {
  tiles: Map<string, TileRecord>;
  pinned: string[];
  order: Map<string, string[]>;
}

export const TILE_SIZE = { w: 320, h: 300 };
const MIN_SIZE = { w: 160, h: 120 };
const SNAP_FRACTIONS = [1 / 3, 1 / 2, 2 / 3, 1];
const SNAP_DISTANCE = 40;

export function snapWidth(width: number, containerWidth: number): number {
  for (const fraction of SNAP_FRACTIONS) {
    const target = containerWidth * fraction - 16;
    if (Math.abs(width - target) <= SNAP_DISTANCE) return target;
  }
  return width;
}

const patchTile = (state: StoreData, tileId: string, patch: TileRecord) => ({
  tiles: new Map(state.tiles).set(tileId, { ...state.tiles.get(tileId), ...patch }),
});

export const createTilesSlice = (set: SetStore) => ({
  tiles: new Map<string, TileRecord>(),
  pinned: [],
  order: new Map<string, string[]>(),

  tiles_setSize: (tileId: string, w: number, h: number) =>
    set((state) => patchTile(state, tileId, { w: Math.max(MIN_SIZE.w, w), h: Math.max(MIN_SIZE.h, h) })),

  tiles_setRepresentation: (tileId: string, representation: Representation) =>
    set((state) => patchTile(state, tileId, { representation })),

  tiles_setMode: (tileId: string, mode: TileMode) => set((state) => patchTile(state, tileId, { mode })),

  tiles_reorder: (parent: string, refs: string[], dragged: string, target: string) =>
    set((state) => {
      const current = state.order.get(parent) ?? refs;
      const movingForward = current.indexOf(dragged) < current.indexOf(target);
      const without = current.filter((ref) => ref !== dragged);
      const targetIndex = without.indexOf(target);
      const at = targetIndex < 0 ? without.length : targetIndex + (movingForward ? 1 : 0);
      without.splice(at, 0, dragged);
      return { order: new Map(state.order).set(parent, without) };
    }),

  tiles_pin: (path: string) =>
    set((state) => (state.pinned.includes(path) ? {} : { pinned: [...state.pinned, path] })),

  tiles_unpin: (path: string) => set((state) => ({ pinned: state.pinned.filter((pinned) => pinned !== path) })),

  tiles_loadWorkspace: (workspace: Workspace) =>
    set((state) => {
      const tiles = new Map(state.tiles);
      for (const { table_path, mode, representation, w, h } of workspace.tiles) {
        tiles.set(table_path, { ...tiles.get(table_path), mode, representation, w, h });
      }
      return { pinned: workspace.tiles.map((tile) => tile.table_path), tiles };
    }),
});
