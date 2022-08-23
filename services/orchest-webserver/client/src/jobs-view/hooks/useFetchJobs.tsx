import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useReportJobsError } from "./useReportJobsError";

/**
 * Fetch all jobs of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchJobs = () => {
  const { projectUuid } = useCustomRoute();
  useReportJobsError();

  const [shouldFetchOnMount, fetchJobs] = useJobsApi((state) => [
    !Boolean(state.jobs) && !state.isFetching,
    state.fetchAll,
  ]);

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);

  const shouldFetch =
    shouldFetchOnMount || hasRegainedFocus || hasChangedProject;

  React.useEffect(() => {
    if (shouldFetch && hasValue(projectUuid)) {
      fetchJobs(projectUuid);
    }
  }, [shouldFetch, projectUuid, fetchJobs]);
};
