import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { BackgroundTask, BackgroundTaskPoller } from "@/utils/webserver-utils";
import { makeRequest, validURL } from "@orchest/lib-utils";
import React from "react";

const validProjectName = (
  projectName = ""
): { valid: boolean; reason?: string } => {
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

const validateImportData = ({
  importUrl,
  projectName,
  setAlert,
}: {
  importUrl: string;
  projectName: string;
  setAlert: (title: string, content: string) => void;
}) => {
  const invalidUrl = !validURL(importUrl) || !importUrl.startsWith("https://");
  const projectNameValidation = validProjectName(projectName);
  const shouldShowAlert = invalidUrl || !projectNameValidation.valid;

  if (shouldShowAlert) {
    const reason = invalidUrl
      ? "Please make sure you enter a valid HTTPS git-repo URL."
      : projectNameValidation.reason;

    setAlert("Error", reason);
    return false;
  }
  return true;
};

const useImportProject = (
  projectName = "",
  importUrl: string,
  onComplete: (result?: BackgroundTask) => void
) => {
  const { setAlert } = useAppContext();
  const backgroundTaskPollerRef = React.useRef(new BackgroundTaskPoller());

  const { data, run, status: fetchStatus, setData } = useAsync<BackgroundTask>({
    initialState: {
      uuid: null,
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
          onComplete(result);
        }
      );
    }
    return () => {
      backgroundTaskPollerRef.current.removeAllTasks();
    };
  }, [fetchStatus, data]);

  const startImport = () => {
    const isValid = validateImportData({ importUrl, projectName, setAlert });
    if (!isValid) {
      onComplete();
      return;
    }
    const jsonData =
      projectName.length > 0
        ? { url: importUrl, project_name: projectName }
        : { url: importUrl };

    run(
      makeRequest("POST", `/async/projects/import-git`, {
        type: "json",
        content: jsonData,
      }).then((response) => JSON.parse(response))
    );
  };

  return { startImport, importResult: data };
};

export { useImportProject };
