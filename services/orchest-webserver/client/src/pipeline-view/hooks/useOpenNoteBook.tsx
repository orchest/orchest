import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import React from "react";

export const useOpenNoteBook = () => {
  const { navigateTo, pipelineUuid, projectUuid } = useCustomRoute();

  const openNotebook = React.useCallback(
    (e: React.MouseEvent | undefined, filePath: string) => {
      // JupyterLabView will auto-start session,
      // so no need to check session here.
      navigateTo(
        siteMap.jupyterLab.path,
        { query: { projectUuid, pipelineUuid, filePath } },
        e
      );
    },
    [navigateTo, pipelineUuid, projectUuid]
  );
  return openNotebook;
};
