import { useEffect } from "react";
import { fetchProjectSettings, saveProjectSettings } from "../api/client";
import { ProjectSettings } from "../types/domain";
import { useStore } from "../store/store";
import { attempt } from "./Notices";

export function useProjectSettings(project: string) {
  const settings = useStore((state) => state.projects.get(project));
  const setSettings = useStore((state) => state.projects_set);

  useEffect(() => {
    if (project && !settings) attempt("project settings", () => fetchProjectSettings(project).then((loaded) => setSettings(project, loaded)));
  }, [project]);

  const save = (next: ProjectSettings) =>
    attempt("saving project settings", () => saveProjectSettings(project, next).then((saved) => setSettings(project, saved)));

  return { settings, save };
}
