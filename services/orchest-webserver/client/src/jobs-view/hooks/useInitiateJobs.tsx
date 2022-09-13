import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchJobs } from "@/hooks/useFetchJobs";
import { useShouldRefetchPerProject } from "@/hooks/useShouldRefetchPerProject";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetch all jobs of a project when app is launched. Will re-fetch when the browser tab regains focus.
 */
export const useInitiateJobs = () => {
  const { projectUuid } = useCustomRoute();

  const shouldRefetch = useShouldRefetchPerProject();

  const isNotLoaded = useJobsApi((state) => !hasValue(state.jobs));

  const shouldFetch = hasValue(projectUuid) && (isNotLoaded || shouldRefetch);

  const { fetchJobs } = useFetchJobs(projectUuid);

  React.useEffect(() => {
    if (shouldFetch) fetchJobs();
  }, [shouldFetch, fetchJobs]);
};