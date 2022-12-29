import { gitImportsApi } from "@/api/git-imports/gitImportsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { usePollGitImport } from "@/hooks/usePollGitImport";
import React from "react";

export const useGitImport = (importUrl: string) => {
  const [gitImportUuid, setGitImportUuid] = React.useState<string>();
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
        await gitImportsApi
          .importGitRepo(importUrl, projectName)
          .then(setGitImportUuid);
      }
    },
    [importUrl, setAlert]
  );

  const { status, project_uuid, result } =
    usePollGitImport(gitImportUuid) ?? {};

  return {
    /** Starts importing the project. */
    start,
    /** How the import is going, or `undefined` if the import has not started. */
    status,
    /** The uuid of the project if it was imported successfully.*/
    projectUuid: project_uuid,
    /** The error if the import failed, otherwise `undefined`. */
    error: result?.error,
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
