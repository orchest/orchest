import { gitImportsApi } from "@/api/git-imports/gitImportsApi";
import { GitImport } from "@/types";
import React from "react";
import { useAsync } from "./useAsync";

const POLL_FREQUENCY = 1000;

const hasFinished = (status: GitImport["status"]) =>
  ["FAILURE", "SUCCESS", "ABORTED"].includes(status);

/**
 * Polls a git import with the specified UUID until it finishes.
 * @param gitImportUuiid The UUID of the git import to poll, or
 *  `undefined` if a UUID is not yet available.
 * @returns The git import if it exists, or `undefined`.
 */
export const usePollGitImport = (gitImportUuid: string | undefined) => {
  const [gitImport, setGitImport] = React.useState<GitImport>();
  const { run } = useAsync<GitImport>();

  React.useEffect(() => {
    if (!gitImportUuid) return;

    const handle = window.setInterval(async () => {
      const gitImport = await run(gitImportsApi.fetchOne(gitImportUuid));
      if (!gitImport) return;

      setGitImport(gitImport);
      if (hasFinished(gitImport.status)) {
        clearInterval(handle);
      }
    }, POLL_FREQUENCY);

    return () => {
      window.clearInterval(handle);
    };
  }, [run, gitImportUuid]);

  return gitImport;
};
