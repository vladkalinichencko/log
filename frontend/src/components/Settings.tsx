import { Button } from "./Button";
import { ACCENTS } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";

export function Settings() {
  const theme = useStore((state: any) => state.theme);
  const accent = useStore((state: any) => state.accent);
  const setTheme = useStore((state: any) => state.settings_setTheme);
  const setAccent = useStore((state: any) => state.settings_setAccent);

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
        {ACCENTS.map((color) => (
          <button
            key={color}
            className={color === accent ? "dot active" : "dot"}
            style={{ background: color }}
            title={color}
            onClick={() => setAccent(color)}
          />
        ))}
      </div>
    </div>
  );
}
