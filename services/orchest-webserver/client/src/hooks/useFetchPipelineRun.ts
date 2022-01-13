import { PipelineRun } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

type FetchPipelineRunProps = {
  jobUuid: string | undefined;
  runUuid: string | undefined;
};

export const useFetchPipelineRun = (props: FetchPipelineRunProps | null) => {
  const { jobUuid, runUuid } = props || {};
  const { data, error, isValidating, revalidate, mutate } = useSWR<PipelineRun>(
    jobUuid && runUuid
      ? `/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`
      : null,
    fetcher
  );

  const setPipelineRun = React.useCallback(
    (
      data?: PipelineRun | Promise<PipelineRun> | MutatorCallback<PipelineRun>
    ) => mutate(data, false),
    [mutate]
  );

  return {
    pipelineRun: data,
    error,
    isFetchingPipelineRun: isValidating,
    fetchPipelineRun: revalidate,
    setPipelineRun,
  };
};
