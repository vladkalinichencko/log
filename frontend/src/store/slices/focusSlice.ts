export interface FocusState {
  focusedPath: string | null;
}

export const createFocusSlice = (set: any) => ({
  focusedPath: null,

  focus_setTarget: (path: string | null) => set({ focusedPath: path }),
});
