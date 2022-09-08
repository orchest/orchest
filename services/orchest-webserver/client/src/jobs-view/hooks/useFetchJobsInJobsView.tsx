import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchJobs } from "@/hooks/useFetchJobs";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetch all jobs of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchJobsInJobsView = () => {
  const { projectUuid } = useCustomRoute();
  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);

  const { fetchJobs } = useFetchJobs(projectUuid);

  const shouldFetchOnMount = useJobsApi((state) => !Boolean(state.jobs));

  const shouldFetch =
    hasValue(projectUuid) &&
    (shouldFetchOnMount || hasRegainedFocus || hasChangedProject);

  React.useEffect(() => {
    if (shouldFetch) fetchJobs();
  }, [shouldFetch, projectUuid, fetchJobs]);
};
