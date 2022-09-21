import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { join } from "@/utils/path";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

export const useOpenFile = () => {
  const {
    navigateTo,
    pipelineUuid,
    projectUuid,
    jobUuid,
    snapshotUuid,
  } = useCustomRoute();
  const {
    pipelineCwd,
    runUuid,
    isReadOnly,
    isJobRun,
    isSnapshot,
  } = usePipelineDataContext();

  const {
    uiState: { steps },
  } = usePipelineUiStateContext();

  const queryArgs = React.useMemo(
    () =>
      isJobRun
        ? { jobUuid, runUuid }
        : isSnapshot
        ? { jobUuid, snapshotUuid }
        : {},
    [jobUuid, runUuid, isJobRun, isSnapshot, snapshotUuid]
  );

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

  const routePath =
    isJobRun || isSnapshot
      ? siteMap.jobRunFilePreview.path
      : siteMap.filePreview.path;

  const openFilePreviewView = React.useCallback(
    (e: React.MouseEvent | undefined, stepUuid: string) => {
      navigateTo(
        routePath,
        {
          query: {
            projectUuid,
            pipelineUuid,
            stepUuid,
            ...queryArgs,
          },
          state: { isReadOnly },
        },
        e
      );
    },
    [routePath, isReadOnly, queryArgs, navigateTo, pipelineUuid, projectUuid]
  );

  return { navigateToJupyterLab, openNotebook, openFile, openFilePreviewView };
};
