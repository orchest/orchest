import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { useHasChanged } from "@/hooks/useHasChanged";
import React from "react";
import { useProjectsContext } from "./ProjectsContext";

export const useAutoFetchPipelines = () => {
  const { state, dispatch } = useProjectsContext();
  const {
    pipelines,
    isFetchingPipelines,
    error,
    fetchPipelines,
  } = useFetchPipelines(state.projectUuid);

  const hasPipelinesChanged = useHasChanged(state.pipelines);

  React.useEffect(() => {
    // When switching projects, state.pipelines will be cleaned up.
    // then we need to refetch.
    // Note that we don't want to trigger this when page is just loaded.
    // because useFetchPipelines will do the inital request.
    const hasPipelineCleanedUp =
      !isFetchingPipelines && hasPipelinesChanged && !state.pipelines;

    if (hasPipelineCleanedUp) fetchPipelines();
  }, [
    isFetchingPipelines,
    state.pipelines,
    hasPipelinesChanged,
    fetchPipelines,
  ]);

  React.useEffect(() => {
    if (!isFetchingPipelines && !error && pipelines) {
      dispatch({ type: "LOAD_PIPELINES", payload: pipelines });
    }
  }, [dispatch, pipelines, isFetchingPipelines, error]);
};
