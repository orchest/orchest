import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { addLeadingSlash, join, trimLeadingSlash } from "@/utils/path";
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
    pipelineJson,
    runUuid,
    isReadOnly,
    isJobRun,
    isSnapshot,
  } = usePipelineDataContext();
  const { pipelines = [] } = useProjectsContext().state;

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

  const openInJupyterLab = React.useCallback(
    (filePathRelativeToRoot: string, event?: React.MouseEvent) => {
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
        event
      );
    },
    [navigateTo, pipelineUuid, projectUuid]
  );

  const notebookFilePath = React.useCallback(
    (pipelineCwd: string, stepUuid: string) => {
      return join(pipelineCwd, steps[stepUuid].file_path);
    },
    [steps]
  );

  const openNotebook = React.useCallback(
    (stepUuid?: string, event?: React.MouseEvent) => {
      if (pipelineCwd && stepUuid)
        openInJupyterLab(notebookFilePath(pipelineCwd, stepUuid), event);
    },
    [notebookFilePath, openInJupyterLab, pipelineCwd]
  );

  const openFile = React.useCallback(
    (filePath: string, event?: React.MouseEvent) => {
      if (pipelineCwd && filePath)
        openInJupyterLab(join(pipelineCwd, filePath), event);
    },
    [openInJupyterLab, pipelineCwd]
  );

  const previewPath =
    isJobRun || isSnapshot
      ? siteMap.jobRunFilePreview.path
      : siteMap.filePreview.path;

  const previewFile = React.useCallback(
    (filePath: string, event?: React.MouseEvent) => {
      if (!pipelineUuid || !pipelineCwd) return;

      const foundStep = Object.values(pipelineJson?.steps || {}).find(
        (step) => {
          const stepFilePath = join(pipelineCwd, step.file_path);

          return addLeadingSlash(stepFilePath) === addLeadingSlash(filePath);
        }
      );

      if (!foundStep) return;

      navigateTo(
        previewPath,
        {
          query: {
            projectUuid,
            pipelineUuid,
            stepUuid: foundStep.uuid,
            ...queryArgs,
          },
          state: { isReadOnly },
        },
        event
      );
    },
    [
      pipelineUuid,
      pipelineCwd,
      pipelineJson?.steps,
      navigateTo,
      previewPath,
      projectUuid,
      queryArgs,
      isReadOnly,
    ]
  );

  const openPipeline = React.useCallback(
    (pipelinePath: string, event?: React.MouseEvent) => {
      const selectedPipeline = pipelines.find(
        ({ path }) => trimLeadingSlash(path) === trimLeadingSlash(pipelinePath)
      );

      navigateTo(
        siteMap.pipeline.path,
        {
          query: {
            projectUuid,
            pipelineUuid: selectedPipeline?.uuid,
            ...queryArgs,
          },
          state: { isReadOnly },
        },
        event
      );
    },
    [isReadOnly, navigateTo, pipelines, projectUuid, queryArgs]
  );

  return {
    openInJupyterLab,
    openNotebook,
    openFile,
    previewFile,
    openPipeline,
  };
};
