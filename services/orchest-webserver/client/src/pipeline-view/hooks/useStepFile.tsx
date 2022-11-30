import {
  FileDescription,
  fileViewerApi,
} from "@/api/file-viewer/fileViewerApi";
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
  const { run, error, status } = useAsync<FileDescription>();
  const [file, setFile] = React.useState<FileDescription>();

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

  return { file, error, status };
};
