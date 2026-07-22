import { Representation } from "../../types/domain";

type TileMode = "table" | "visualization";

interface TileRecord {
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

const DEFAULT_W = 320;
const DEFAULT_H = 300;
const MIN_W = 160;
const MIN_H = 120;
const SNAP_FRACTIONS = [1 / 3, 1 / 2, 2 / 3, 1];
const SNAP_DISTANCE = 40;

export function snapWidth(width: number, containerWidth: number): number {
  for (const fraction of SNAP_FRACTIONS) {
    const target = containerWidth * fraction - 16;
    if (Math.abs(width - target) <= SNAP_DISTANCE) return target;
  }
  return width;
}

export const createTilesSlice = (set: any) => ({
  tiles: new Map<string, TileRecord>(),
  pinned: [],
  order: new Map<string, string[]>(),

  tiles_setSize: (tileId: string, w: number, h: number) =>
    set((state: any) => {
      const tiles = new Map<string, TileRecord>(state.tiles);
      tiles.set(tileId, {
        ...tiles.get(tileId),
        w: Math.max(MIN_W, w),
        h: Math.max(MIN_H, h),
      });
      return { tiles };
    }),

  tiles_reorder: (parent: string, refs: string[], dragged: string, target: string) =>
    set((state: any) => {
      const current: string[] = state.order.get(parent) ?? refs;
      const movingForward = current.indexOf(dragged) < current.indexOf(target);
      const without = current.filter((ref: string) => ref !== dragged);
      const targetIndex = without.indexOf(target);
      const at = targetIndex < 0 ? without.length : targetIndex + (movingForward ? 1 : 0);
      without.splice(at, 0, dragged);
      const order = new Map<string, string[]>(state.order);
      order.set(parent, without);
      return { order };
    }),

  tiles_setRepresentation: (tileId: string, representation: Representation) =>
    set((state: any) => {
      const tiles = new Map<string, TileRecord>(state.tiles);
      tiles.set(tileId, { ...tiles.get(tileId), representation });
      return { tiles };
    }),

  tiles_setMode: (tileId: string, mode: TileMode) =>
    set((state: any) => {
      const tiles = new Map<string, TileRecord>(state.tiles);
      tiles.set(tileId, { ...tiles.get(tileId), mode });
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
          mode: tile.mode,
          representation: tile.representation,
          w: tile.w,
          h: tile.h,
        });
      }
      return { pinned: workspace.tiles.map((tile: any) => tile.table_path), tiles };
    }),
});
