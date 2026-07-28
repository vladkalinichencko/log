export type FocusKind = "cell" | "row" | "col";

export interface FocusTarget {
  tableId: string;
  kind: FocusKind;
  r: number;
  c: number;
}

export interface FocusRange extends Omit<FocusTarget, "tableId"> {
  endR: number;
  endC: number;
}

export interface FocusSelection {
  tableId: string;
  ranges: FocusRange[];
}

export interface FocusState {
  focused: FocusSelection | null;
  picking: boolean;
  pickedColumn: string | null;
}

type FocusMode = "replace" | "extend" | "add";

const pointRange = ({ kind, r, c }: FocusTarget): FocusRange => ({
  kind,
  r,
  c,
  endR: r,
  endC: c,
});

export function focus_reducer(
  focused: FocusSelection | null,
  target: FocusTarget,
  mode: FocusMode
): FocusSelection {
  const range = pointRange(target);
  if (!focused || focused.tableId !== target.tableId || mode === "replace") {
    return { tableId: target.tableId, ranges: [range] };
  }
  if (mode === "add") {
    return { ...focused, ranges: [...focused.ranges, range] };
  }
  const ranges = [...focused.ranges];
  const active = ranges[ranges.length - 1];
  ranges[ranges.length - 1] = active?.kind === target.kind
    ? { ...active, endR: target.r, endC: target.c }
    : range;
  return { ...focused, ranges };
}

export const createFocusSlice = (set: any) => ({
  focused: null,
  picking: false,
  pickedColumn: null,

  focus_setTarget: (target: FocusTarget | null) =>
    set({ focused: target ? { tableId: target.tableId, ranges: [pointRange(target)] } : null }),

  focus_startRange: (target: FocusTarget, mode: FocusMode) =>
    set((state: FocusState) => ({ focused: focus_reducer(state.focused, target, mode) })),

  focus_extendRange: (target: FocusTarget) =>
    set((state: FocusState) => ({ focused: focus_reducer(state.focused, target, "extend") })),

  focus_setPicking: (picking: boolean) => set({ picking }),

  focus_pickColumn: (pickedColumn: string | null) => set({ pickedColumn }),
});
