import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetch all jobs of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchJobs = () => {
  const { projectUuid } = useCustomRoute();

  const shouldFetchOnMount = useJobsApi(
    (state) => !Boolean(state.jobs) && !state.isFetching
  );

  const fetchJobs = useJobsApi((state) => state.fetchAll);

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
