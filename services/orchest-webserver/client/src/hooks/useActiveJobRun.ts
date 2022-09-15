import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import React from "react";
import { useAsync } from "./useAsync";
import { useCancelJobRun } from "./useCancelJobRun";

/**
 * Fetches the active job run as defined by the current route,
 * and provides functions to interface with said run.
 */
export const useActiveJobRun = () => {
  const cancel = useCancelJobRun();
  const fetchActive = useJobRunsApi((api) => api.fetchActive);
  const activeRun = useJobRunsApi((api) => api.active);
  const { run, status, error } = useAsync();

  const cancelRun = React.useCallback(() => {
    if (activeRun) cancel(activeRun.uuid);
  }, [cancel, activeRun]);

  React.useEffect(() => {
    if (!activeRun && status !== "PENDING") {
      run(fetchActive()).catch();
    }
  }, [fetchActive, activeRun, run, status]);

  return {
    run: activeRun,
    cancelRun,
    error,
    isFetching: status === "PENDING",
    isCancelable:
      activeRun?.status === "STARTED" || activeRun?.status === "PENDING",
  };
};
