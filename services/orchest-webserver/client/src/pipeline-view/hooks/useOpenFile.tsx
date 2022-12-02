import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useNavigate } from "@/hooks/useCustomRoute";
import { addLeadingSlash, join, trimLeadingSlash } from "@/utils/path";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

export const useOpenFile = () => {
  const navigate = useNavigate();
  const { pipelineCwd, pipelineJson } = usePipelineDataContext();
  const { pipelines = [] } = useProjectsContext().state;

  const {
    uiState: { steps },
  } = usePipelineUiStateContext();

  const openInJupyterLab = React.useCallback(
    (filePathRelativeToRoot: string, event?: React.MouseEvent) => {
      // JupyterLabView will start the session automatically,
      // so no need to check if there's a running session.
      navigate({
        route: "jupyterLab",
        query: { filePath: filePathRelativeToRoot },
        event,
      });
    },
    [navigate]
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

  const previewFile = React.useCallback(
    (filePath: string, event?: React.MouseEvent) => {
      if (!pipelineCwd) return;

      const foundStep = Object.values(pipelineJson?.steps || {}).find(
        (step) => {
          const stepFilePath = join(pipelineCwd, step.file_path);

          return addLeadingSlash(stepFilePath) === addLeadingSlash(filePath);
        }
      );

      if (!foundStep) return;

      navigate({
        route: "filePreview",
        query: { stepUuid: foundStep.uuid },
        event,
      });
    },
    [pipelineCwd, pipelineJson?.steps, navigate]
  );

  const openPipeline = React.useCallback(
    (pipelinePath: string, event?: React.MouseEvent) => {
      const selectedPipeline = pipelines.find(
        ({ path }) => trimLeadingSlash(path) === trimLeadingSlash(pipelinePath)
      );

      navigate({
        route: "pipeline",
        query: { pipelineUuid: selectedPipeline?.uuid },
        event,
      });
    },
    [navigate, pipelines]
  );

  return {
    openInJupyterLab,
    openNotebook,
    openFile,
    previewFile,
    openPipeline,
  };
};
