import type { PipelineMetaData } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { useSWRConfig } from "swr";
import { MutatorCallback } from "swr/dist/types";

export const useFetchPipelines = (projectUuid: string | undefined) => {
  const { cache } = useSWRConfig();
  const { data, error, isValidating, mutate } = useSWR<PipelineMetaData[]>(
    projectUuid ? `/async/pipelines/${projectUuid}` : null,
    (url) =>
      fetcher<{ result: PipelineMetaData[] }>(url).then(
        (response) => response.result
      )
  );

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
    // provide a simple way to get fetched data via projectUuid
    // in case that we need to fetch pipelines conditionally
    getCache: (projectUuid: string) =>
      cache.get(`/async/pipelines/${projectUuid}`) as
        | PipelineMetaData[]
        | undefined,
  };
};
