import { useEffect } from "react";
import { Button } from "./Button";
import { SERIES } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";
import { path_segments } from "../store/selectors/pathSelectors";
import { useCurrentPath } from "./useCurrentPath";
import { useProjectSettings } from "./useProjectSettings";

const ALERT_RULES: [string, string][] = [
  ["non_finite", "a metric becomes NaN or infinite"],
  ["spike", "a metric jumps far outside its recent range"],
  ["stall", "a step takes far longer than usual"],
  ["heartbeat", "a running run stops reporting"],
];

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
  const project = path_segments(useCurrentPath())[0];

  return (
    <div>
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
          <Button key={token} swatch={`var(${token})`} ghost active={token === accent} title={token} onClick={() => setAccent(token)} />
        ))}
      </div>
      {project && <ProjectAlerts project={project} />}
    </div>
  );
}

function ProjectAlerts({ project }: { project: string }) {
  const { settings, save } = useProjectSettings(project);
  return (
    <>
      <div className="group">
        <span>alerts in {project}</span>
      </div>
      {ALERT_RULES.map(([rule, label]) => (
        <label key={rule} className="group">
          <input
            type="checkbox"
            checked={settings?.alerts[rule] ?? true}
            disabled={!settings}
            onChange={(event) => save({ ...settings!, alerts: { ...settings!.alerts, [rule]: event.target.checked } })}
          />
          {label}
        </label>
      ))}
    </>
  );
}
