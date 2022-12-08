import { fileViewerApi, StepFile } from "@/api/file-viewer/fileViewerApi";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

export const useStepFile = () => {
  const {
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid,
    stepUuid,
  } = useCustomRoute();
  const { run, error, status } = useAsync<StepFile>();
  const [stepFile, setFile] = React.useState<StepFile>();

  React.useEffect(() => {
    if (!projectUuid || !pipelineUuid || !stepUuid) return;

    run(
      fileViewerApi.fetchOne({
        projectUuid,
        pipelineUuid,
        stepUuid,
        jobUuid,
        runUuid,
      })
    ).then(setFile);
  }, [jobUuid, pipelineUuid, projectUuid, runUuid, stepUuid, run]);

  return { stepFile, error, status };
};
