export type FocusKind = "cell" | "row" | "col";

export interface FocusTarget {
  tableId: string;
  kind: FocusKind;
  r: number;
  c: number;
}

export interface FocusState {
  focused: FocusTarget | null;
  picking: boolean;
  pickedColumn: string | null;
}

export const createFocusSlice = (set: any) => ({
  focused: null,
  picking: false,
  pickedColumn: null,

  focus_setTarget: (target: FocusTarget | null) => set({ focused: target }),

  focus_setPicking: (picking: boolean) => set({ picking }),

  focus_pickColumn: (pickedColumn: string | null) => set({ pickedColumn }),
});
