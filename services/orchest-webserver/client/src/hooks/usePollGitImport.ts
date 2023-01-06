import { gitImportsApi } from "@/api/git-imports/gitImportsApi";
import { GitImportOperation } from "@/types";
import React from "react";
import { useAsync } from "./useAsync";

const POLL_FREQUENCY = 1000;

const hasFinished = (status: GitImportOperation["status"]) =>
  ["FAILURE", "SUCCESS", "ABORTED"].includes(status);

/**
 * Polls a git import with the specified UUID until it finishes.
 * @param operationUuid The UUID of the git import to poll, or
 *  `undefined` if a UUID is not yet available.
 * @returns The git import if it exists, or `undefined`.
 */
export const usePollGitImport = (operationUuid: string | undefined) => {
  const { run, data: gitImport, setData: setGitImport } = useAsync<
    GitImportOperation | undefined
  >();

  const reset = React.useCallback(() => {
    setGitImport(undefined);
  }, [setGitImport]);

  React.useEffect(() => {
    if (!operationUuid) return;

    const handle = window.setInterval(async () => {
      const operation = await run(
        gitImportsApi.fetchImportOperation(operationUuid)
      );
      if (!operation) return;
      if (hasFinished(operation.status)) {
        clearInterval(handle);
      }
    }, POLL_FREQUENCY);

    return () => {
      window.clearInterval(handle);
    };
  }, [run, operationUuid]);

  return { ...gitImport, reset };
};
