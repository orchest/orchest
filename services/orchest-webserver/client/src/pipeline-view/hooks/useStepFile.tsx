import { fileViewerApi, StepFile } from "@/api/file-viewer/fileViewerApi";
import { useAsync } from "@/hooks/useAsync";
import { useCurrentQuery } from "@/hooks/useCustomRoute";
import { FileRoot } from "@/utils/file";
import { stepPathToProjectPath } from "@/utils/pipeline";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

type ResolvedStepFile = Omit<StepFile, "filename" | "ext"> & {
  path: string;
  root: FileRoot;
};

export const useStepFile = (stepUuid?: string) => {
  const {
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid,
    stepUuid: queriedStepUuid,
  } = useCurrentQuery();
  const { run, error, status } = useAsync<StepFile>();
  const [stepFile, setFile] = React.useState<ResolvedStepFile>();
  const { pipelineCwd } = usePipelineDataContext();

  stepUuid = stepUuid ?? queriedStepUuid;

  React.useEffect(() => {
    if (!projectUuid || !pipelineUuid || !stepUuid || !pipelineCwd) return;

    run(
      fileViewerApi.fetchOne({
        projectUuid,
        pipelineUuid,
        stepUuid,
        jobUuid,
        runUuid,
      })
    ).then((file) => {
      if (file) {
        setFile({
          ...stepPathToProjectPath(file.filename, pipelineCwd),
          content: file.content,
          step_title: file.step_title,
        });
      }
    });
  }, [jobUuid, pipelineUuid, projectUuid, runUuid, stepUuid, run, pipelineCwd]);

  return { stepFile, error, status };
};
