import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { JobData } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetch all jobs of a project. Will re-fetch when the browser tab regains focus.
 */
export const useFetchJobs = () => {
  const { projectUuid } = useCustomRoute();

  const { run, status } = useAsync<JobData[]>();
  const shouldFetchOnMount = useJobsApi(
    (state) => !Boolean(state.jobs) && status !== "PENDING"
  );

  const fetchJobs = useJobsApi((state) => state.fetchAll);

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);

  const shouldFetch =
    shouldFetchOnMount || hasRegainedFocus || hasChangedProject;

  React.useEffect(() => {
    if (shouldFetch && hasValue(projectUuid)) {
      run(fetchJobs(projectUuid)).catch((error) => {
        if (!error.isCanceled) console.error(error);
      });
    }
  }, [shouldFetch, projectUuid, fetchJobs, run]);
};
