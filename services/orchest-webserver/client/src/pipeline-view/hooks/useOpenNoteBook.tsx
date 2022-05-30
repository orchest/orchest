import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

export const useOpenNoteBook = () => {
  const { navigateTo, pipelineUuid, projectUuid } = useCustomRoute();

  const openNotebook = React.useCallback(
    (e: React.MouseEvent | undefined, filePathRelativeToRoot: string) => {
      // JupyterLabView will start the session automatically,
      // so no need to check if there's a running session.
      navigateTo(
        siteMap.jupyterLab.path,
        {
          query: {
            projectUuid,
            pipelineUuid,
            filePath: filePathRelativeToRoot,
          },
        },
        e
      );
    },
    [navigateTo, pipelineUuid, projectUuid]
  );
  return openNotebook;
};
