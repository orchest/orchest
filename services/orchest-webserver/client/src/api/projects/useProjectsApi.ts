import { Project } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { FetchAllParams, projectsApi } from "./projectsApi";

export type ProjectsApi = {
  projects: Project[] | undefined;
  /** A list of the project UUIDs currently being deleted. */
  deleting: string[];
  /** A list of project UUIDs currently being imported. */
  importing: string[];
  /** Loads all available projects. */
  init: MemoizePending<(params: FetchAllParams) => Promise<void>>;
  /** Irreversibly deletes the project and all data associated with it. */
  delete: MemoizePending<(projectUuid: string) => Promise<void>>;
  /** Assigns a new name to a project with a given UUID. */
  rename: MemoizePending<
    (projectUuid: string, newName: string) => Promise<void>
  >;
  /** Starts importing a git repo. */
  importGitRepo: MemoizePending<
    (url: string, projectName: string) => Promise<void>
  >;
};

export const useProjectsApi = create<ProjectsApi>((set) => {
  const reload = async (params: FetchAllParams = {}) =>
    set({ projects: await projectsApi.fetchAll(params) });

  return {
    projects: undefined,
    deleting: [],
    importing: [],
    init: memoizeFor(500, reload),
    rename: memoizeFor(500, async (projectUuid: string, newName: string) => {
      await projectsApi.put(projectUuid, { name: newName });
      await reload();
    }),
    delete: memoizeFor(500, async (projectUuid: string) => {
      set(({ deleting }) => ({ deleting: [...deleting, projectUuid] }));

      await projectsApi.delete(projectUuid);

      set(({ deleting }) => ({
        deleting: deleting.filter((uuid) => uuid !== projectUuid),
      }));

      await reload();
    }),
    importGitRepo: memoizeFor(500, async (url, projectName) => {
      const uuid = await projectsApi.importGitRepo(url, projectName);

      set(({ importing }) => ({ importing: [...importing, uuid] }));
    }),
  };
});
