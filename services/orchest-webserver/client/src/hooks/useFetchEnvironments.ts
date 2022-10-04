import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { EnvironmentData } from "@/types";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchEnvironments = () => {
  const { run, status, error } = useAsync<EnvironmentData[]>();
  const request = useEnvironmentsApi((state) => state.fetchAll);
  const environments = useEnvironmentsApi((state) => state.environments || []);

  const isAllowedToFetch = React.useRef(false);
  isAllowedToFetch.current = status !== "PENDING";

  const fetchEnvironments = React.useCallback(
    async (projectUuid: string | undefined, language?: string) => {
      if (isAllowedToFetch.current && projectUuid)
        return run(request(projectUuid, language));
    },
    [request, run]
  );

  return { environments, error, status, fetchEnvironments };
};
