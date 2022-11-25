import { Project } from "@/types";
import { join } from "@/utils/path";
import { queryArgs } from "@/utils/text";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const PROJECTS_API_URL = "/async/projects";

export type ProjectUpdateData = Partial<
  Omit<Project, "uuid"> & { name: string }
>;

export type NewProjectData = { project_uuid: string };

export type FetchAllParams = {
  sessionCounts?: boolean;
  activeJobCounts?: boolean;
  skipDiscovery?: boolean;
};

/**
 * Permanently deletes a project.
 * @param projectUuid The UUID of the project to delete.
 */
const deleteProject = (projectUuid: string): Promise<void> =>
  fetcher(join(PROJECTS_API_URL, projectUuid), { method: "DELETE" });

/**
 * Used to update information about the project,
 * or rename it by providing a new name-property in the data.
 * @param projectUuid The UUID of the project to update
 * @param data What information should be updated
 */
export const put = (
  projectUuid: string,
  data: ProjectUpdateData
): Promise<void> =>
  fetcher(join(PROJECTS_API_URL, projectUuid), {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify(data),
  });

/** Fetches the project with the given UUID   */
export const fetchOne = (projectUuid: string) =>
  fetcher<Project>(join(PROJECTS_API_URL, projectUuid));

/** Starts the import of a git repo, and returns its UUID. */
export const importGitRepo = (url: string, projectName?: string) =>
  fetcher<{ uuid: string }>(join(PROJECTS_API_URL, "/import-git"), {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ url, project_name: projectName }),
  }).then(({ uuid }) => uuid);

/** Fetches all available projects. */
export const fetchAll = ({
  sessionCounts = true,
  activeJobCounts = true,
  skipDiscovery = false,
} = {}): Promise<Project[]> =>
  fetcher(
    PROJECTS_API_URL +
      "?" +
      queryArgs({ sessionCounts, activeJobCounts, skipDiscovery })
  );

/** Creates a new project with the provided name, then returns its UUID. */
export const post = (projectName: string) =>
  fetcher<NewProjectData>(PROJECTS_API_URL, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ name: projectName }),
  }).then((data) => data.project_uuid);

export const projectsApi = {
  fetchOne,
  fetchAll,
  post,
  put,
  importGitRepo,
  delete: deleteProject,
};
