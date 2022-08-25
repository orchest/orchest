import { usePipelineJsonApi } from "@/api/pipelines/usePipelineJsonApi";
import React from "react";
import { useRegainBrowserTabFocus } from "./useFocusBrowserTab";
import { useHasChanged } from "./useHasChanged";

type FetchPipelineJsonProps = {
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
};

export const useFetchPipelineJson = (
  props: FetchPipelineJsonProps | undefined
) => {
  const { pipelineUuid, projectUuid, jobUuid, runUuid } = props || {};

  const [
    pipelineJson,
    fetch,
    isFetching,
    error,
  ] = usePipelineJsonApi((state) => [
    state.pipelineJson,
    state.fetch,
    state.isFetching,
    state.error,
  ]);

  const fetchPipelineJson = React.useCallback(() => {
    if (!projectUuid || !pipelineUuid) return;
    return fetch(projectUuid, pipelineUuid, jobUuid, runUuid);
  }, [fetch, jobUuid, pipelineUuid, projectUuid, runUuid]);

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);
  const hasChangedPipeline = useHasChanged(pipelineUuid);

  const shouldFetch =
    hasRegainedFocus || hasChangedProject || hasChangedPipeline;

  React.useEffect(() => {
    if (shouldFetch) {
      fetchPipelineJson();
    }
  }, [shouldFetch, fetchPipelineJson]);

  return {
    pipelineJson,
    error,
    isFetchingPipelineJson: isFetching,
    fetchPipelineJson,
  };
};
