import { useJobsApi } from "@/api/jobs/useJobsApi";
import React from "react";
import { useHydrate } from "./useHydrate";

export function useFetchJob(jobUuid: string | undefined) {
  const job = useJobsApi((api) => (jobUuid ? api.jobs?.[jobUuid] : undefined));
  const fetchOne = useJobsApi((api) => api.fetchOne);
  const fetchJob = React.useCallback(() => {
    return fetchOne(jobUuid);
  }, [fetchOne, jobUuid]);
  const state = useHydrate(fetchJob, { rehydrate: true });

  return { job, ...state };
}
