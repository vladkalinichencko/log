import type { SetStore } from "../store";

export interface Notice {
  id: number;
  message: string;
  retry: (() => void) | null;
}

export interface NoticesState {
  notices: Notice[];
}

export const createNoticesSlice = (set: SetStore) => ({
  notices: [],

  notices_push: (message: string, retry: (() => void) | null) =>
    set((state) => ({
      notices: [...state.notices, { id: (state.notices[state.notices.length - 1]?.id ?? 0) + 1, message, retry }],
    })),

  notices_dismiss: (id: number) => set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
});
