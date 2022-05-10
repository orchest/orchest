import { useAppContext } from "@/contexts/AppContext";
import { BackgroundTask, BackgroundTaskPoller } from "@/utils/webserver-utils";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";

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

export const useImportGitRepo = (
  importUrl: string,
  onComplete: (result?: BackgroundTask) => void
) => {
  const { setAlert } = useAppContext();
  const backgroundTaskPoller = React.useMemo(
    () => new BackgroundTaskPoller(),
    []
  );

  const [data, setData] = React.useState<BackgroundTask>({
    uuid: "",
    result: null,
    status: "PENDING",
  });

  React.useEffect(() => {
    return () => {
      backgroundTaskPoller.removeAllTasks();
    };
  }, [backgroundTaskPoller]);

  const startImport = React.useCallback(
    async (projectName: string | undefined) => {
      const validation = validProjectName(projectName);
      if (!validation.valid) {
        setAlert(
          "Warning",
          `Invalid project name: ${projectName}. ${validation.reason}`
        );
        onComplete();
        return;
      }

      const { uuid } = await fetcher<{ uuid: string }>(
        `/async/projects/import-git`,
        {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({
            url: importUrl,
            project_name: validation.value,
          }),
        }
      );

      backgroundTaskPoller.startPollingBackgroundTask(uuid, (result) => {
        if (result.status === "SUCCESS") {
          setData(result);
          backgroundTaskPoller.removeAllTasks();
          onComplete(result);
        }
      });
    },
    [importUrl, onComplete, setAlert, backgroundTaskPoller, setData]
  );

  const clearImportResult = React.useCallback(() => {
    setData({
      uuid: "",
      result: null,
      status: "PENDING",
    });
  }, [setData]);

  return { startImport, importResult: data, clearImportResult };
};
