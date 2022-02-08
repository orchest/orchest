import { Environment } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

export function useFetchEnvironment(initialEnvironment: Environment) {
  const { project_uuid, uuid } = initialEnvironment;

  const { data, error, isValidating, mutate } = useSWR<Environment>(
    project_uuid && uuid ? `/store/environments/${project_uuid}/${uuid}` : null,
    fetcher,
    { fallbackData: initialEnvironment }
  );

  const setEnvironment = React.useCallback(
    (
      data?: Environment | Promise<Environment> | MutatorCallback<Environment>
    ) => mutate(data, false),
    [mutate]
  );

  return {
    environment: data,
    error,
    isFetchingEnvironment: isValidating,
    fetchEnvironment: mutate,
    setEnvironment,
  };
}
