import { useJobsApi } from "@/api/jobs/useJobsApi";
import { JobData } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useValidQueryArgs } from "./useValidQueryArgs";

export const useFetchJobs = (projectUuid: string | undefined) => {
  const { projectUuid: validProjectUuid } = useValidQueryArgs({ projectUuid });

  const { run, status, error, data } = useAsync<JobData[]>();
  const request = useJobsApi((state) => state.fetchAll);
  const isAllowedToFetch = hasValue(validProjectUuid) && status !== "PENDING";

  const fetchJobs = React.useCallback(async () => {
    if (isAllowedToFetch) return run(request(validProjectUuid));
  }, [request, validProjectUuid, run, isAllowedToFetch]);

  return { jobs: data, error, status, fetchJobs };
};
