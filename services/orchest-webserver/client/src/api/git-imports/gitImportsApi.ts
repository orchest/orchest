import { GitImportOperation } from "@/types";
import { join } from "@/utils/path";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const GIT_IMPORTS_API_URL = "/async/projects/import-git";

/** Fetches the git import operation with the given UUID.   */
export const fetchImportOperation = (gitImportUuid: string) =>
  fetcher<GitImportOperation>(join(GIT_IMPORTS_API_URL, gitImportUuid));

/** Starts the import of a git repo, and returns the UUID of the operation. */
export const startImportOperation = (url: string, projectName?: string) =>
  fetcher<GitImportOperation>(GIT_IMPORTS_API_URL, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ url, project_name: projectName }),
  }).then(({ uuid }) => uuid);

export const gitImportsApi = {
  fetchImportOperation,
  startImportOperation,
};
