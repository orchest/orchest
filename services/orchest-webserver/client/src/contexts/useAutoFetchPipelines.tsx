import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import React from "react";
import { useProjectsContext } from "./ProjectsContext";

export const useAutoFetchPipelines = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();
  const shouldFetch =
    !state.hasLoadedPipelinesInPipelineEditor ||
    !pipelineUuid ||
    !(state.pipelines || []).find((pipeline) => pipelineUuid === pipeline.uuid);

  const { pipelines, status } = useFetchPipelines(
    shouldFetch ? projectUuid : undefined
  );

  React.useEffect(() => {
    if (status === "RESOLVED" && pipelines && shouldFetch) {
      dispatch({ type: "LOAD_PIPELINES", payload: pipelines });
    }
  }, [dispatch, status, pipelines, shouldFetch]);

  return status === "RESOLVED" ? pipelines : undefined;
};
