import { projectsApi } from "@/api/projects/projectsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { usePollBackgroundTask } from "@/hooks/useBackgroundTask";
import React from "react";

export const useGitImport = (importUrl: string) => {
  const [importTaskUuid, setImportTaskUuid] = React.useState<string>();
  const { setAlert } = useGlobalContext();

  const start = React.useCallback(
    async (projectName: string | undefined) => {
      const validation = validProjectName(projectName);

      if (!validation.valid) {
        setAlert(
          "Warning",
          `Invalid project name: ${projectName}. ${validation.reason}`
        );
      } else {
        await projectsApi
          .importGitRepo(importUrl, projectName)
          .then(setImportTaskUuid);
      }
    },
    [importUrl, setAlert]
  );

  const { status, result } = usePollBackgroundTask(importTaskUuid) ?? {};

  return {
    /** Starts importing the project. */
    start,
    /** How the import is going, or `undefined` if the import has not started. */
    status,
    /** The path of project if the import was successful, otherwise `undefined`.  */
    path: status === "SUCCESS" ? result : undefined,
    /** The error if the import failed, otherwise `undefined`. */
    error: status === "FAILURE" ? result : undefined,
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
