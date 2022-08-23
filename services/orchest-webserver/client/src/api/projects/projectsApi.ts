import { Project } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";

export type PutProjectData = Partial<Omit<Project, "uuid"> & { name: string }>;

export type NewProjectData = { project_uuid: string };

/**
 * Permanently deletes a project.
 * @param projectUuid The UUID of the project to delete.
 */
const deleteProject = (projectUuid: string): Promise<void> =>
  fetcher(`/async/projects/${projectUuid}`, { method: "DELETE" });

/**
 * Used to update information about the project,
 * or rename it by providing a new name-property in the data.
 * @param projectUuid The UUID of the project to update
 * @param data What information should be updated
 */
export const put = (projectUuid: string, data: PutProjectData): Promise<void> =>
  fetcher(`/async/projects/${projectUuid}`, {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify(data),
  });

/** Fetches the project with the given UUID   */
export const fetch = (projectUuid: string) =>
  fetcher<Project>(`/async/projects/${projectUuid}`);

/** Fetches all available projects. */
export const fetchAll = (): Promise<Project[]> => fetcher(`/async/projects`);

/** Creates a new project with the provided name. */
export const post = (projectName: string) =>
  fetcher<NewProjectData>("/async/projects", {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ name: projectName }),
  });

export const projectsApi = {
  fetch,
  fetchAll,
  post,
  put,
  delete: deleteProject,
};
