import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useInterval } from "@/hooks/use-interval";
import { hasValue } from "@orchest/lib-utils";

/**
 * Fetches the status of the jobs by polling.
 */
export const usePollJobsStatus = () => {
  const { projectUuid, jobs, updateStatus } = useJobsApi();
  const isStoreLoaded = hasValue(projectUuid) && hasValue(jobs);

  useInterval(updateStatus, !isStoreLoaded ? undefined : 1000);
};
