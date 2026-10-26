import { useEffect, useState } from "react";
import { Button } from "./Button";
import { SERIES } from "../store/slices/settingsSlice";
import { useStore } from "../store/store";
import { path_segments } from "../store/selectors/pathSelectors";
import { useCurrentPath } from "./useCurrentPath";
import { useProjectSettings } from "./useProjectSettings";
import { systemNotifyFsm } from "../fsm/systemNotifyFsm";
import { disable_system_notifications, enable_system_notifications, system_notifications_state } from "../modules/notify";

const SYSTEM_NOTIFY_NOTE: Record<string, string> = {
  blocked: " (blocked in this browser's site settings)",
  unsupported: " (this browser cannot receive push)",
};

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
      <SystemNotifications />
      {project && <ProjectAlerts project={project} />}
    </div>
  );
}

function SystemNotifications() {
  const [state, setState] = useState(systemNotifyFsm.initial);
  const notify = useStore((store) => store.notices_push);
  const send = (event: Parameters<typeof systemNotifyFsm.next>[1]) => setState((current) => systemNotifyFsm.next(current, event));
  useEffect(() => {
    system_notifications_state().then(send);
  }, []);
  const turn = (on: boolean) => {
    send(on ? "turn_on" : "turn_off");
    (on ? enable_system_notifications() : disable_system_notifications()).then(system_notifications_state).then(send, (error: Error) => {
      send("failure");
      notify(`system notifications: ${error.message}`, { label: "Retry", perform: () => turn(on) });
    });
  };
  return (
    <label className="group" data-state={state}>
      <input
        type="checkbox"
        checked={state === "on" || state === "turning_off"}
        disabled={state !== "on" && state !== "off"}
        onChange={(event) => turn(event.target.checked)}
      />
      alerts as system notifications in this browser, also when the tab is closed{SYSTEM_NOTIFY_NOTE[state] ?? ""}
    </label>
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
