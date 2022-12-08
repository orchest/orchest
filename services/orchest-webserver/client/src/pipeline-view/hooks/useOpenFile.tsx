import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useNavigate } from "@/hooks/useCustomRoute";
import { UnpackedPath } from "@/utils/file";
import { join, trimLeadingSlash } from "@/utils/path";
import { stepPathToProjectPath } from "@/utils/pipeline";
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
    ({ root, path }: UnpackedPath, event?: React.MouseEvent) => {
      if (!pipelineCwd) return;

      const foundStep = Object.values(pipelineJson?.steps || {}).find(
        (step) => {
          const { root: stepRoot, path: stepPath } = stepPathToProjectPath(
            step.file_path,
            pipelineCwd
          );

          return stepRoot === root && stepPath === path;
        }
      );

      if (foundStep) {
        navigate({
          route: "filePreview",
          query: { stepUuid: foundStep.uuid },
          clear: ["fileRoot", "filePath"],
          event,
        });
      } else {
        navigate({
          route: "filePreview",
          query: { fileRoot: root, filePath: path },
          clear: ["stepUuid"],
          event,
        });
      }
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
