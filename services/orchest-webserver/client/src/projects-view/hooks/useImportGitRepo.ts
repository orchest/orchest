import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useHasChanged } from "@/hooks/useHasChanged";
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
  projectName: unknown,
  importUrl: string,
  onComplete: (result?: BackgroundTask) => void
) => {
  const { setAlert } = useAppContext();
  const backgroundTaskPoller = React.useMemo(
    () => new BackgroundTaskPoller(),
    []
  );

  const { data, run, status: fetchStatus, setData } = useAsync<BackgroundTask>({
    initialState: {
      uuid: "",
      result: null,
      status: "PENDING",
    },
  });

  const hasStartedBackgroundTask = React.useRef(false);
  const shouldReset = useHasChanged(projectName);
  React.useEffect(() => {
    hasStartedBackgroundTask.current = false;
  }, [shouldReset]);

  React.useEffect(() => {
    if (
      fetchStatus === "RESOLVED" &&
      data &&
      !hasStartedBackgroundTask.current
    ) {
      backgroundTaskPoller.startPollingBackgroundTask(data.uuid, (result) => {
        if (result.status === "SUCCESS" && !hasStartedBackgroundTask.current) {
          hasStartedBackgroundTask.current = true;
          setData(result);
          onComplete(result);
        }
      });
    }

    return () => {
      backgroundTaskPoller.removeAllTasks();
    };
  }, [fetchStatus, onComplete, data, setData, backgroundTaskPoller]);

  const startImport = React.useCallback(() => {
    const validation = validProjectName(projectName);
    if (!validation.valid) {
      setAlert(
        "Warning",
        `Invalid project name: ${projectName}. ${validation.reason}`
      );
      onComplete();
      return;
    }

    run(
      fetcher<BackgroundTask>(`/async/projects/import-git`, {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({
          url: importUrl,
          project_name: validation.value,
        }),
      })
    );
  }, [importUrl, projectName, onComplete, run, setAlert]);

  const clearImportResult = React.useCallback(() => {
    setData({
      uuid: "",
      result: null,
      status: "PENDING",
    });
  }, [setData]);

  return { startImport, importResult: data, clearImportResult };
};
