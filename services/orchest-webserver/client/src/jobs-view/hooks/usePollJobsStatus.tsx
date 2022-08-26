import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useInterval } from "@/hooks/use-interval";
import { hasValue } from "@orchest/lib-utils";

/**
 * Fetches the status of the jobs by polling.
 */
export const usePollJobsStatus = () => {
  const isStoreLoaded = useJobsApi(
    (state) => hasValue(state.projectUuid) && hasValue(state.jobs)
  );
  const updateStatus = useJobsApi((state) => state.updateStatus);

  useInterval(updateStatus, !isStoreLoaded ? undefined : 1000);
};
