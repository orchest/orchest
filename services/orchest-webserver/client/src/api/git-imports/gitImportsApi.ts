import { GitImport } from "@/types";
import { join } from "@/utils/path";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const GIT_IMPORTS_API_URL = "/async/projects/import-git";

/** Fetches the git import operation with the given UUID.   */
export const fetchOne = (gitImportUuid: string) =>
  fetcher<GitImport>(join(GIT_IMPORTS_API_URL, gitImportUuid));

/** Starts the import of a git repo, and returns its UUID. */
export const importGitRepo = (url: string, projectName?: string) =>
  fetcher<GitImport>(GIT_IMPORTS_API_URL, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ url, project_name: projectName }),
  }).then(({ uuid }) => uuid);

export const gitImportsApi = {
  fetchOne,
  importGitRepo,
};
