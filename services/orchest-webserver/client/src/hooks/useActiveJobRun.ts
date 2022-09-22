import { useActiveJobRunApi } from "@/api/job-runs/useActiveJobRunApi";
import React from "react";
import { useAsync } from "./useAsync";
import { useCancelJobRun } from "./useCancelJobRun";

/**
 * Fetches the active job run as defined by the current route,
 * and provides functions to interface with said run.
 */
export const useActiveJobRun = () => {
  const fetchActive = useActiveJobRunApi((api) => api.fetch);
  const activeRun = useActiveJobRunApi((api) => api.run);
  const cancel = useActiveJobRunApi((api) => api.cancel);
  const cancelRun = useCancelJobRun(cancel);
  const { run, status, error } = useAsync();

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
