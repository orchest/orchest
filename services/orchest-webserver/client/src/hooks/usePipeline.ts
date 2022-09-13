import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import React from "react";
import { useAsync } from "./useAsync";

export const usePipeline = (projectUuid: string, pipelineUuid: string) => {
  const pipelines = usePipelinesApi((api) => api.pipelines);
  const fetchPipeline = usePipelinesApi((api) => api.fetchOne);
  const { run, error, status } = useAsync();

  const pipeline = React.useMemo(
    () =>
      pipelines?.find(
        (pipeline) =>
          pipeline.uuid === pipelineUuid &&
          pipeline.project_uuid === projectUuid
      ),
    [pipelineUuid, pipelines, projectUuid]
  );

  React.useEffect(() => {
    if (!pipeline) run(fetchPipeline(projectUuid, pipelineUuid)).catch();
  }, [fetchPipeline, pipeline, pipelineUuid, projectUuid, run]);

  const refresh = React.useCallback(() => {
    run(fetchPipeline.bypass(projectUuid, pipelineUuid)).catch();
  }, [fetchPipeline, pipelineUuid, projectUuid, run]);

  return { pipeline, error, refresh, isFetching: status === "PENDING" };
};
