import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjectJobs } from "@/hooks/useFetchProjectJobs";
import { useShouldRefetchPerProject } from "@/hooks/useShouldRefetchPerProject";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetch all jobs of a project when app is launched. Will re-fetch when the browser tab regains focus.
 */
export const useInitiateJobs = () => {
  const { projectUuid } = useCustomRoute();

  const shouldRefetch = useShouldRefetchPerProject();

  const shouldFetch = useProjectJobsApi(
    (state) => hasValue(projectUuid) && (!hasValue(state.jobs) || shouldRefetch)
  );
  const { fetchJobs } = useFetchProjectJobs(projectUuid);
  React.useEffect(() => {
    if (shouldFetch) fetchJobs();
  }, [shouldFetch, fetchJobs]);

  const setJobs = useProjectJobsApi((state) => state.setJobs);
  React.useEffect(() => {
    if (!projectUuid) setJobs(undefined);
  }, [projectUuid, setJobs]);
};
