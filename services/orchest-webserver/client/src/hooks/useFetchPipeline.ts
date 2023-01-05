import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchPipeline = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) => {
  const pipeline = usePipelinesApi((api) =>
    projectUuid && pipelineUuid
      ? api.find(projectUuid, pipelineUuid)
      : undefined
  );
  const fetchPipeline = usePipelinesApi((api) => api.fetchOne);
  const { run, error, status } = useAsync();

  React.useEffect(() => {
    if (!projectUuid || !pipelineUuid) return;
    if (status !== "IDLE") return;

    run(fetchPipeline(projectUuid, pipelineUuid)).catch();
  }, [fetchPipeline, pipeline, pipelineUuid, projectUuid, run, status]);

  const refresh = React.useCallback(() => {
    if (!projectUuid || !pipelineUuid) return;

    run(fetchPipeline.bypass(projectUuid, pipelineUuid)).catch();
  }, [fetchPipeline, pipelineUuid, projectUuid, run]);

  return { pipeline, error, refresh, isFetching: status === "PENDING" };
};
