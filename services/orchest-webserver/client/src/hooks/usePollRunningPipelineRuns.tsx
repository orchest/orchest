import React from "react";
import { useFetchRunningPipelineRuns } from "./useFetchRunningPipelineRuns";

const POLL_TIMEOUT = 5000;

/** Polls for running interactive pipeline runs.. */
export const usePollRunningPipelineRuns = () => {
  const { running, reload } = useFetchRunningPipelineRuns();

  React.useEffect(() => {
    const handle = window.setInterval(() => {
      reload();
    }, POLL_TIMEOUT);

    return () => window.clearInterval(handle);
  }, [reload]);

  return running;
};
