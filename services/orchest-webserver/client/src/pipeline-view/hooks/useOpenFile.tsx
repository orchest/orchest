import { useCustomRoute, useNavigate } from "@/hooks/useCustomRoute";
import { useFetchActiveJob } from "@/hooks/useFetchActiveJob";
import { useFetchActivePipelines } from "@/hooks/useFetchActivePipelines";
import { RouteName } from "@/routingConfig";
import { UnpackedPath } from "@/utils/file";
import { join, trimLeadingSlash } from "@/utils/path";
import { stepPathToProjectPath } from "@/utils/pipeline";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

export const useOpenFile = () => {
  const navigate = useNavigate();
  const activeJob = useFetchActiveJob();
  const { pipelineCwd, pipelineJson } = usePipelineDataContext();
  const pipelines = useFetchActivePipelines();
  const { jobUuid } = useCustomRoute();

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

      const route: RouteName = hasValue(jobUuid)
        ? "jobFilePreview"
        : "filePreview";

      if (foundStep) {
        navigate({
          route,
          query: { stepUuid: foundStep.uuid },
          clear: ["fileRoot", "filePath"],
          event,
        });
      } else {
        navigate({
          route,
          query: { fileRoot: root, filePath: path },
          clear: ["stepUuid"],
          event,
        });
      }
    },
    [pipelineCwd, pipelineJson?.steps, jobUuid, navigate]
  );

  const openPipeline = React.useCallback(
    (pipelinePath: string, event?: React.MouseEvent) => {
      const { uuid } =
        pipelines.find(({ path }) => {
          return trimLeadingSlash(path) === trimLeadingSlash(pipelinePath);
        }) ?? {};

      if (!uuid) return;
      // NOTE:
      //  If you try to navigate to a pipeline which is different
      //  to the one in the job, the `file-manager/browse` API will fail
      //  and crash the page.
      if (activeJob && uuid !== activeJob.pipeline_uuid) return;

      const route: RouteName = hasValue(activeJob) ? "jobRun" : "pipeline";

      navigate({
        route: route,
        query: { pipelineUuid: uuid },
        event,
      });
    },
    [activeJob, navigate, pipelines]
  );

  return {
    openInJupyterLab,
    openNotebook,
    openFile,
    previewFile,
    openPipeline,
  };
};
