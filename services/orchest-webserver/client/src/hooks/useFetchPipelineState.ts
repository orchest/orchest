import { pipelinesApi } from "@/api/pipelines/pipelinesApi";
import { PipelineState } from "@/types";
import React from "react";
import { useHydrate } from "./useHydrate";

export const useFetchPipelineState = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) => {
  const [pipeline, setPipeline] = React.useState<PipelineState>();
  const fetchState = React.useCallback(async () => {
    if (!projectUuid || !pipelineUuid) return;
    await pipelinesApi.fetchState(projectUuid, pipelineUuid).then(setPipeline);
  }, [projectUuid, pipelineUuid]);
  const state = useHydrate(fetchState, { rehydrate: true });

  return { pipeline, ...state };
};
