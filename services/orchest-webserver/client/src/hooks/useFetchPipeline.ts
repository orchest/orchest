import { Pipeline } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

type FetchPipelineProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
};

export const useFetchPipeline = (props: FetchPipelineProps | null) => {
  const { projectUuid, pipelineUuid } = props || {};
  const { data, error, isValidating, revalidate, mutate } = useSWR<Pipeline>(
    projectUuid && pipelineUuid
      ? `/async/pipelines/${projectUuid}/${pipelineUuid}`
      : null,
    fetcher
  );

  const setPipeline = React.useCallback(
    (data?: Pipeline | Promise<Pipeline> | MutatorCallback<Pipeline>) =>
      mutate(data, false),
    [mutate]
  );

  return {
    pipeline: data,
    error,
    isFetchingPipeline: isValidating,
    fetchPipeline: revalidate,
    setPipeline,
  };
};
