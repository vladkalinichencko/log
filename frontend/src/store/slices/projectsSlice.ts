import { ProjectSettings } from "../../types/domain";
import type { SetStore } from "../store";

export interface ProjectsState {
  projects: Map<string, ProjectSettings>;
}

export const createProjectsSlice = (set: SetStore) => ({
  projects: new Map<string, ProjectSettings>(),

  projects_set: (project: string, settings: ProjectSettings) =>
    set((state) => ({ projects: new Map(state.projects).set(project, settings) })),
});
