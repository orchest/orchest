import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import React from "react";
import { useAsync } from "./useAsync";
import { useCancelRun } from "./useCancelRun";
import { useCustomRoute } from "./useCustomRoute";

/**
 * Fetches the active job run as defined by the current route,
 * and provides functions to interface with said run.
 */
export const useActiveJobRun = () => {
  const { runUuid } = useCustomRoute();
  const cancel = useCancelRun();
  const fetchRun = useJobRunsApi((api) => api.fetchOne);
  const runs = useJobRunsApi((api) => api.runs || []);
  const { run, status, error } = useAsync();

  const activeRun = React.useMemo(
    () => (runUuid ? runs.find(({ uuid }) => uuid === runUuid) : undefined),
    [runUuid, runs]
  );

  const cancelRun = React.useCallback(() => {
    if (runUuid) cancel(runUuid);
  }, [cancel, runUuid]);

  React.useEffect(() => {
    if (runUuid && !activeRun && status !== "PENDING") {
      run(fetchRun(runUuid)).catch();
    }
  }, [fetchRun, activeRun, runUuid, run, status]);

  return {
    run: activeRun,
    cancelRun,
    error,
    isFetching: status === "PENDING",
    isCancelable:
      activeRun?.status === "STARTED" || activeRun?.status === "PENDING",
  };
};
