import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { join } from "@/utils/path";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

export const useOpenFile = () => {
  const { navigateTo, pipelineUuid, projectUuid, jobUuid } = useCustomRoute();
  const { pipelineCwd, runUuid, isReadOnly } = usePipelineDataContext();

  const {
    uiState: { steps },
  } = usePipelineUiStateContext();

  const isJobRun = jobUuid && runUuid;
  const jobRunQueryArgs = React.useMemo(() => ({ jobUuid, runUuid }), [
    jobUuid,
    runUuid,
  ]);

  const navigateToJupyterLab = React.useCallback(
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

  const notebookFilePath = React.useCallback(
    (pipelineCwd: string, stepUUID: string) => {
      return join(pipelineCwd, steps[stepUUID].file_path);
    },
    [steps]
  );

  const openNotebook = React.useCallback(
    (e: React.MouseEvent | undefined, stepUuid?: string) => {
      if (pipelineCwd && stepUuid)
        navigateToJupyterLab(e, notebookFilePath(pipelineCwd, stepUuid));
    },
    [notebookFilePath, navigateToJupyterLab, pipelineCwd]
  );

  const openFile = React.useCallback(
    (e: React.MouseEvent | undefined, filePath: string) => {
      if (pipelineCwd && filePath)
        navigateToJupyterLab(e, join(pipelineCwd, filePath));
    },
    [navigateToJupyterLab, pipelineCwd]
  );

  const openFilePreviewView = React.useCallback(
    (e: React.MouseEvent | undefined, stepUuid: string) => {
      navigateTo(
        isJobRun ? siteMap.jobRunFilePreview.path : siteMap.filePreview.path,
        {
          query: {
            projectUuid,
            pipelineUuid,
            stepUuid,
            ...(isJobRun ? jobRunQueryArgs : undefined),
          },
          state: { isReadOnly },
        },
        e
      );
    },
    [
      isJobRun,
      isReadOnly,
      jobRunQueryArgs,
      navigateTo,
      pipelineUuid,
      projectUuid,
    ]
  );

  return { navigateToJupyterLab, openNotebook, openFile, openFilePreviewView };
};
