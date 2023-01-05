import { gitImportsApi } from "@/api/git-imports/gitImportsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { usePollGitImport } from "@/hooks/usePollGitImport";
import React from "react";

/**
 * Provides a start function for requesting a new import operation.
 * Once a request passes through, a polling task will be triggered in the background.
 */
export const useGitImport = (importUrl: string) => {
  const { setAlert } = useGlobalContext();
  const {
    run,
    status: requestImportStatus,
    data: gitImportOperationUuid,
    setData: setImportOperationUuid,
  } = useAsync<string>();

  const start = React.useCallback(
    async (projectName: string) => {
      if (requestImportStatus === "PENDING") return;

      const validation = validProjectName(projectName);
      if (!validation.valid) {
        setAlert(
          "Warning",
          `Invalid project name: ${projectName}. ${validation.reason}`
        );
      } else {
        await run(gitImportsApi.startImportOperation(importUrl, projectName));
      }
    },
    [importUrl, setAlert, run, requestImportStatus]
  );

  const { status, project_uuid, result, reset: resetPoller } = usePollGitImport(
    gitImportOperationUuid
  );

  const reset = React.useCallback(() => {
    setImportOperationUuid(undefined);
    resetPoller();
  }, [resetPoller, setImportOperationUuid]);

  return {
    /** Request to start a new git-import operation. */
    start,
    /** How the import operation is going, or `undefined` if the operation has not started. */
    status,
    /** The uuid of the project if it was imported successfully.*/
    projectUuid: project_uuid,
    /** The error if the import failed, otherwise `undefined`. */
    error: result?.error,
    /** Reset the git import states */
    reset,
  };
};

export const validProjectName = (
  projectName: unknown
): { valid: true; value: string } | { valid: false; reason: string } => {
  const headsUpText = "Please make sure you enter a valid project name. ";
  if (
    typeof projectName !== "string" ||
    projectName.length === 0 ||
    projectName.match("[^A-Za-z0-9_.-]")
  ) {
    return {
      valid: false,
      reason:
        headsUpText +
        `A project name has to be a valid git repository name and thus can only contain alphabetic characters, numbers and the special characters: '_.-'. The regex would be [A-Za-z0-9_.-].`,
    };
  }
  return { valid: true, value: projectName };
};
