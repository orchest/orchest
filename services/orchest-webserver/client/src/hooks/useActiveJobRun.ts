import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import React from "react";
import { useAsync } from "./useAsync";
import { useCustomRoute } from "./useCustomRoute";

/**
 * Fetches the active job run as defined by the current route,
 * and provides functions to interface with said run.
 */
export const useActiveJobRun = () => {
  const { runUuid } = useCustomRoute();
  const cancel = useJobRunsApi((api) => api.cancel);
  const fetchRun = useJobRunsApi((api) => api.fetchOne);
  const runs = useJobRunsApi((api) => api.runs || []);
  const { run, status, error } = useAsync();

  const currentRun = React.useMemo(
    () => (runUuid ? runs.find(({ uuid }) => uuid === runUuid) : undefined),
    [runUuid, runs]
  );

  const cancelRun = React.useCallback(() => {
    if (runUuid) cancel(runUuid);
  }, [cancel, runUuid]);

  React.useEffect(() => {
    if (runUuid && !currentRun && status !== "PENDING") {
      run(fetchRun(runUuid)).catch();
    }
  }, [fetchRun, currentRun, runUuid, run, status]);

  return {
    run,
    cancelRun,
    error,
    isFetching: status === "PENDING",
    isCancelable:
      currentRun?.status === "STARTED" || currentRun?.status === "PENDING",
  };
};
