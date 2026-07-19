export type FocusKind = "cell" | "row" | "col";

export interface FocusTarget {
  tableId: string;
  kind: FocusKind;
  r: number;
  c: number;
}

export interface FocusState {
  focused: FocusTarget | null;
}

export const createFocusSlice = (set: any) => ({
  focused: null,

  focus_setTarget: (target: FocusTarget | null) => set({ focused: target }),
});
