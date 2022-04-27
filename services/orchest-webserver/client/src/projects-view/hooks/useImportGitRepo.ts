import { useAsync } from "@/hooks/useAsync";
import { BackgroundTask, BackgroundTaskPoller } from "@/utils/webserver-utils";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";

export const validProjectName = (
  projectName = ""
): { valid: true } | { valid: false; reason: string } => {
  const headsUpText = "Please make sure you enter a valid project name. ";
  if (projectName.match("[^A-Za-z0-9_.-]")) {
    return {
      valid: false,
      reason:
        headsUpText +
        `A project name has to be a valid git repository name and thus can only contain alphabetic characters, numbers and the special characters: '_.-'. The regex would be [A-Za-z0-9_.-].`,
    };
  }
  return { valid: true };
};

export const useImportGitRepo = (
  projectName = "",
  importUrl: string,
  onComplete: (result?: BackgroundTask) => void
) => {
  const onCompleteRef = React.useRef(onComplete);
  const backgroundTaskPollerRef = React.useRef(new BackgroundTaskPoller());

  const { data, run, status: fetchStatus, setData } = useAsync<BackgroundTask>({
    initialState: {
      uuid: "",
      result: null,
      status: "PENDING",
    },
  });

  React.useEffect(() => {
    if (fetchStatus === "RESOLVED" && data) {
      backgroundTaskPollerRef.current.startPollingBackgroundTask(
        data.uuid,
        (result) => {
          setData(result);
          if (onCompleteRef.current) onCompleteRef.current(result);
        }
      );
    }
    const poller = backgroundTaskPollerRef.current;
    return () => {
      poller.removeAllTasks();
    };
  }, [fetchStatus, data, setData]);

  const startImport = () => {
    const { valid } = validProjectName(projectName);
    if (!valid) return;

    const jsonData =
      projectName.length > 0
        ? { url: importUrl, project_name: projectName }
        : { url: importUrl };

    run(
      fetcher<BackgroundTask>(`/async/projects/import-git`, {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify(jsonData),
      })
    );
  };

  const clearImportResult = React.useCallback(() => {
    setData({
      uuid: "",
      result: null,
      status: "PENDING",
    });
  }, [setData]);

  return { startImport, importResult: data, clearImportResult };
};
