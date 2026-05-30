import { Representation } from "../../types/domain";

export interface TilesState {
  tiles: Map<string, { representation: Representation }>;
}

export const createTilesSlice = (set: any) => ({
  tiles: new Map<string, { representation: Representation }>(),

  tiles_setRepresentation: (tileId: string, representation: Representation) =>
    set((state: any) => ({
      tiles: new Map(state.tiles).set(tileId, { representation }),
    })),
});
