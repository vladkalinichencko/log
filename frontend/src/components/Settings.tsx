import { useEffect } from "react";
import { Button } from "./Button";
import { SERIES } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";

export function useTheme() {
  const theme = useStore((state) => state.theme);
  const accent = useStore((state) => state.accent);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--accent", `var(${accent})`);
  }, [theme, accent]);
}

export function Settings() {
  const theme = useStore((state) => state.theme);
  const accent = useStore((state) => state.accent);
  const setTheme = useStore((state) => state.settings_setTheme);
  const setAccent = useStore((state) => state.settings_setAccent);

  return (
    <div className="content">
      <div className="group">
        <span>theme</span>
        <div className="toggle">
          <Button label="light" active={theme === "light"} onClick={() => setTheme("light")} />
          <Button label="dark" active={theme === "dark"} onClick={() => setTheme("dark")} />
        </div>
      </div>
      <div className="group">
        <span>accent</span>
        {SERIES.map((token) => (
          <button
            key={token}
            className={token === accent ? "dot active" : "dot"}
            style={{ background: `var(${token})` }}
            title={token}
            onClick={() => setAccent(token)}
          />
        ))}
      </div>
    </div>
  );
}
