import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useActivePipelineRun } from "./useActivePipelineRun";
import { useAsync } from "./useAsync";

/**
 * Fetches the currently active pipeline run.
 * Supports both Interactive Runs and Job Runs.
 */
export const useFetchActivePipelineRun = () => {
  const activeRun = useActivePipelineRun((state) => state.run);
  const fetchActiveRun = useActivePipelineRun((state) => state.fetch);
  const { run, status } = useAsync();

  React.useEffect(() => {
    if (!hasValue(activeRun) && status === "IDLE") {
      run(fetchActiveRun());
    }
  }, [activeRun, fetchActiveRun, run, status]);

  return activeRun;
};
