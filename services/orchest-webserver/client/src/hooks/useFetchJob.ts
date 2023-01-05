import { useJobsApi } from "@/api/jobs/useJobsApi";
import React from "react";
import { useHydrate } from "./useHydrate";

export function useFetchJob(jobUuid: string | undefined) {
  const job = useJobsApi((api) => (jobUuid ? api.jobs?.[jobUuid] : undefined));
  const fetchJob = useJobsApi((api) => api.fetchOne);
  const hydrate = React.useCallback(async () => {
    if (!jobUuid) return;

    await fetchJob(jobUuid);
  }, [fetchJob, jobUuid]);

  const state = useHydrate(hydrate);

  return { job, ...state };
}
