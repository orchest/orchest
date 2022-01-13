import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

type Pipeline = {
  uuid: string;
  path: string;
  name: string;
};

export const useFetchPipelines = (projectUuid: string | undefined) => {
  const { data, error, isValidating, revalidate, mutate } = useSWR<Pipeline[]>(
    projectUuid ? `/async/pipelines/${projectUuid}` : null,
    (url) =>
      fetcher<{ result: Pipeline[] }>(url).then((response) => response.result)
  );

  const setPipelines = React.useCallback(
    (data?: Pipeline[] | Promise<Pipeline[]> | MutatorCallback<Pipeline[]>) =>
      mutate(data, false),
    [mutate]
  );

  return {
    pipelines: data,
    error,
    isFetchingPipelines: isValidating,
    fetchPipelines: revalidate,
    setPipelines,
  };
};
