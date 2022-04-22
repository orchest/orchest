import { Pipeline } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

type FetchPipelineProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
};

export const fetchPipeline = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) =>
  projectUuid && pipelineUuid
    ? fetcher<Pipeline>(`/async/pipelines/${projectUuid}/${pipelineUuid}`)
    : undefined;

export const useFetchPipeline = (props: FetchPipelineProps | null) => {
  const { projectUuid, pipelineUuid, clearCacheOnUnmount } = props || {};
  const { data, error, isValidating, mutate } = useSWR<Pipeline | undefined>(
    projectUuid && pipelineUuid
      ? `/async/pipelines/${projectUuid}/${pipelineUuid}`
      : null,
    () => fetchPipeline(projectUuid, pipelineUuid)
  );

  const setPipeline = React.useCallback(
    (
      data?:
        | Pipeline
        | undefined
        | Promise<Pipeline | undefined>
        | MutatorCallback<Pipeline | undefined>
    ) => mutate(data, false),
    [mutate]
  );

  React.useEffect(() => {
    return () => {
      if (clearCacheOnUnmount) {
        setPipeline(undefined);
      }
    };
  }, [clearCacheOnUnmount, setPipeline]);

  return {
    pipeline: data,
    error,
    isFetchingPipeline: isValidating,
    fetchPipeline: mutate,
    setPipeline,
  };
};
