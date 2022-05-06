import type { PipelineMetaData } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { useSWRConfig } from "swr";
import { MutatorCallback } from "swr/dist/types";

export const fetchPipelines = (projectUuid: string, isFullPath = false) =>
  fetcher<{ result: PipelineMetaData[] }>(
    isFullPath ? projectUuid : `/async/pipelines/${projectUuid}`
  ).then((response) => response.result);

export const useFetchPipelines = (projectUuid: string | undefined) => {
  const { cache } = useSWRConfig();
  const { data, error, isValidating, mutate } = useSWR<PipelineMetaData[]>(
    projectUuid ? `/async/pipelines/${projectUuid}` : null,
    (url) => fetchPipelines(url, true)
  );

  if (error) {
    console.log(error);
  }

  const setPipelines = React.useCallback(
    (
      data?:
        | PipelineMetaData[]
        | Promise<PipelineMetaData[]>
        | MutatorCallback<PipelineMetaData[]>
    ) => mutate(data, false),
    [mutate]
  );

  const pipelines =
    data ||
    (cache.get(`/async/pipelines/${projectUuid}`) as
      | PipelineMetaData[]
      | undefined);

  return {
    pipelines,
    error,
    isFetchingPipelines: isValidating,
    fetchPipelines: mutate,
    setPipelines,
  };
};
