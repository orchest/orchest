import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { EnvironmentData } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useValidQueryArgs } from "./useValidQueryArgs";

export const useFetchEnvironments = (projectUuid: string | undefined) => {
  const { projectUuid: validProjectUuid } = useValidQueryArgs({ projectUuid });

  const { run, status, error } = useAsync<EnvironmentData[]>();
  const request = useEnvironmentsApi((state) => state.fetchAll);
  const environments = useEnvironmentsApi((state) => state.environments || []);

  const isAllowedToFetch = hasValue(validProjectUuid) && status !== "PENDING";

  const fetchEnvironments = React.useCallback(
    async (language?: string) => {
      if (isAllowedToFetch) return run(request(validProjectUuid, language));
    },
    [request, validProjectUuid, run, isAllowedToFetch]
  );

  return { environments, error, status, fetchEnvironments };
};
