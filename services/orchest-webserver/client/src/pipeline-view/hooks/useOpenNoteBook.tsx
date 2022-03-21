import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import React from "react";

export const useOpenNoteBook = () => {
  const { setAlert } = useAppContext();
  const { navigateTo, pipelineUuid, projectUuid } = useCustomRoute();
  const { getSession } = useSessionsContext();

  const openNotebook = React.useCallback(
    (e: React.MouseEvent | undefined, filePath: string) => {
      const session = getSession({
        pipelineUuid,
        projectUuid,
      });
      if (session?.status === "RUNNING") {
        navigateTo(
          siteMap.jupyterLab.path,
          { query: { projectUuid, pipelineUuid, filePath } },
          e
        );
        return;
      }
      if (session?.status === "LAUNCHING") {
        setAlert(
          "Error",
          "Please wait for the session to start before opening the Notebook in Jupyter."
        );
        return;
      }

      setAlert(
        "Error",
        "Please start the session before opening the Notebook in Jupyter."
      );
    },
    [setAlert, getSession, navigateTo, pipelineUuid, projectUuid]
  );
  return openNotebook;
};
