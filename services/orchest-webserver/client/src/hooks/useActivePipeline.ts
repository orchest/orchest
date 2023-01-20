import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import React from "react";
import { useCurrentQuery } from "./useCustomRoute";

export const useActivePipeline = () => {
  const { pipelineUuid, projectUuid } = useCurrentQuery();
  const find = usePipelinesApi((api) => api.find);
  const pipeline = React.useMemo(() => {
    if (!projectUuid || !pipelineUuid) return undefined;
    else return find(projectUuid, pipelineUuid);
  }, [find, projectUuid, pipelineUuid]);

  return pipeline;
};
