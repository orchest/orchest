import { PipelineRun } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

type FetchPipelineRunProps = {
  jobUuid: string | undefined;
  runUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
};

export const fetchPipelineRun = (
  jobUuid: string | undefined,
  runUuid: string | undefined
) =>
  jobUuid && runUuid
    ? fetcher<PipelineRun>(`/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`)
    : undefined;

export const useFetchPipelineRun = (props: FetchPipelineRunProps | null) => {
  const { jobUuid, runUuid, clearCacheOnUnmount, revalidateOnFocus = true } =
    props || {};

  const cacheKey =
    jobUuid && runUuid ? `/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}` : "";

  const { data, error, isValidating, mutate } = useSWR<PipelineRun | undefined>(
    cacheKey || null,
    () => fetchPipelineRun(jobUuid, runUuid),
    { revalidateOnFocus }
  );

  const setPipelineRun = React.useCallback(
    (
      data?:
        | PipelineRun
        | undefined
        | Promise<PipelineRun | undefined>
        | MutatorCallback<PipelineRun | undefined>
    ) => mutate(data, false),
    [mutate]
  );

  React.useEffect(() => {
    return () => {
      if (clearCacheOnUnmount) {
        setPipelineRun(undefined);
      }
    };
  }, [clearCacheOnUnmount, setPipelineRun]);

  return {
    pipelineRun: data,
    error,
    isFetchingPipelineRun: isValidating,
    fetchPipelineRun: mutate,
    setPipelineRun,
  };
};
