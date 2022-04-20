import type { PipelineMetaData } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { useSWRConfig } from "swr";
import { MutatorCallback } from "swr/dist/types";

export const useFetchPipelines = ({
  projectUuid,
  shouldFetch = true,
}: {
  projectUuid: string | undefined;
  shouldFetch?: boolean;
}) => {
  const { cache } = useSWRConfig();
  const { data, error, isValidating, mutate } = useSWR<PipelineMetaData[]>(
    projectUuid && shouldFetch ? `/async/pipelines/${projectUuid}` : null,
    (url) =>
      fetcher<{ result: PipelineMetaData[] }>(url).then(
        (response) => response.result
      )
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
