import { Environment } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

export function useFetchEnvironments(
  projectUuid: string | undefined,
  queryString = ""
) {
  const { data, error, isValidating, mutate } = useSWR<Environment[]>(
    projectUuid ? `/store/environments/${projectUuid}${queryString}` : null,
    fetcher
  );

  const setEnvironments = React.useCallback(
    (
      data?:
        | Environment[]
        | Promise<Environment[]>
        | MutatorCallback<Environment[]>
    ) => mutate(data, false),
    [mutate]
  );

  return {
    environments: data,
    error,
    isFetchingEnvironments: isValidating,
    fetchEnvironments: mutate,
    setEnvironments,
  };
}
