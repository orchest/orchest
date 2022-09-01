import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { equates } from "@/utils/record";
import React from "react";
import { useCustomRoute } from "./useCustomRoute";

/**
 * Extracts the current job_uuid and run_uuid from the route
 * and fetches said job run from the back-end.
 *
 * It also provides helpers to interface with this run.
 */
export const useCurrentJobRun = () => {
  const { jobUuid, runUuid } = useCustomRoute();
  const cancel = useJobRunsApi((api) => api.cancel);
  const fetchRun = useJobRunsApi((api) => api.fetch);
  const runs = useJobRunsApi((api) => api.runs);

  const run = React.useMemo(
    () => (runUuid ? runs.find(equates("uuid", runUuid)) : undefined),
    [runUuid, runs]
  );

  const cancelRun = React.useCallback(() => {
    if (jobUuid && runUuid) cancel(jobUuid, runUuid);
  }, [cancel, jobUuid, runUuid]);

  React.useEffect(() => {
    if (jobUuid && runUuid && !run) fetchRun(jobUuid, runUuid);
  }, [fetchRun, jobUuid, runUuid, run]);

  return {
    run,
    cancelRun,
    isCancellable: run?.status === "STARTED" || run?.status === "PENDING",
  };
};
