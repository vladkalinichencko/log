export interface RouteState {
  currentPath: string;
  history: string[];
  historyIndex: number;
}

export const createRouteSlice = (set: any) => ({
  currentPath: "",
  history: [""],
  historyIndex: 0,

  route_navigate: (path: string) =>
    set((state: any) => ({
      currentPath: path,
      history: [...state.history.slice(0, state.historyIndex + 1), path],
      historyIndex: state.historyIndex + 1,
    })),

  route_back: () =>
    set((state: any) => ({
      currentPath:
        state.historyIndex > 0
          ? state.history[state.historyIndex - 1]
          : state.currentPath,
      historyIndex: Math.max(0, state.historyIndex - 1),
    })),

  route_forward: () =>
    set((state: any) => ({
      currentPath:
        state.historyIndex < state.history.length - 1
          ? state.history[state.historyIndex + 1]
          : state.currentPath,
      historyIndex: Math.min(state.history.length - 1, state.historyIndex + 1),
    })),
});
