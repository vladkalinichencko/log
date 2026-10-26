import type { SetStore } from "../store";

export type Theme = "light" | "dark";

export const SERIES = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6"];

export const CATEGORICAL_ORDER = ["--series-1", "--series-5", "--series-6", "--series-3", "--series-2", "--series-4"];

export interface SettingsState {
  theme: Theme;
  accent: string;
}

const storedAccent = localStorage.getItem("accent") ?? "";

export const createSettingsSlice = (set: SetStore) => ({
  theme: (localStorage.getItem("theme") as Theme | null) ?? "light",
  accent: SERIES.includes(storedAccent) ? storedAccent : SERIES[0],

  settings_setTheme: (theme: Theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },

  settings_setAccent: (accent: string) => {
    localStorage.setItem("accent", accent);
    set({ accent });
  },
});
