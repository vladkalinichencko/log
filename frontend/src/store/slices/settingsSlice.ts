export type Theme = "light" | "dark";

export const ACCENTS = ["#e11d1d", "#e91e8c", "#a855f7", "#6366f1", "#3b82f6", "#34d399"];

export interface SettingsState {
  theme: Theme;
  accent: string;
}

export const createSettingsSlice = (set: any) => ({
  theme: (localStorage.getItem("theme") as Theme) ?? "light",
  accent: localStorage.getItem("accent") ?? ACCENTS[0],

  settings_setTheme: (theme: Theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },

  settings_setAccent: (accent: string) => {
    localStorage.setItem("accent", accent);
    set({ accent });
  },
});
