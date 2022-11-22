import { Project } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { persist } from "zustand/middleware";
import { FetchAllParams, projectsApi } from "./projectsApi";

export type ProjectsApi = {
  projects: Project[] | undefined;
  /** A list of the project UUIDs currently being deleted. */
  deleting: string[];
  /** Loads all available projects. */
  init: MemoizePending<(params: FetchAllParams) => Promise<Project[]>>;
  /** Irreversibly deletes the project and all data associated with it. */
  delete: MemoizePending<(projectUuid: string) => Promise<void>>;
  /** Assigns a new name to a project with a given UUID. */
  rename: MemoizePending<
    (projectUuid: string, newName: string) => Promise<void>
  >;
};

export const useProjectsApi = create(
  persist<ProjectsApi>(
    (set) => {
      const reload = async (params: FetchAllParams = {}) => {
        const projects = await projectsApi.fetchAll(params);

        set({ projects });

        return projects;
      };

      return {
        projects: undefined,
        deleting: [],
        init: memoizeFor(500, reload),
        rename: memoizeFor(
          500,
          async (projectUuid: string, newName: string) => {
            await projectsApi.put(projectUuid, { name: newName });
            await reload();
          }
        ),
        delete: memoizeFor(500, async (projectUuid: string) => {
          set(({ deleting }) => ({ deleting: [...deleting, projectUuid] }));

          await projectsApi.delete(projectUuid);

          set(({ deleting }) => ({
            deleting: deleting.filter((uuid) => uuid !== projectUuid),
          }));

          await reload();
        }),
      };
    },
    {
      name: "orchest.projects",
      partialize: (state) => ({
        ...state,
        deleting: [],
        projects: state.projects,
      }),
    }
  )
);
