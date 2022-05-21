import { Environment } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

export function useFetchEnvironments(
  projectUuid: string | undefined,
  queryString = ""
) {
  const { run, data, setData, error, status } = useAsync<Environment[]>();

  const fetchEnvironments = React.useCallback(() => {
    if (!projectUuid) return;
    return run(fetcher(`/store/environments/${projectUuid}${queryString}`));
  }, [run, projectUuid, queryString]);

  React.useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  return {
    environments: data,
    error,
    isFetchingEnvironments: status === "PENDING",
    fetchEnvironments,
    setEnvironments: setData,
  };
}
