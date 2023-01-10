import React from "react";
import { useFetchPipelineRuns } from "./useFetchPipelineRuns";

const POLL_TIMEOUT = 5000;

export const usePollPipelineRuns = () => {
  const { runs, reload } = useFetchPipelineRuns();

  React.useEffect(() => {
    const handle = window.setInterval(() => {
      reload();
    }, POLL_TIMEOUT);

    return () => window.clearInterval(handle);
  }, [reload]);

  return { runs };
};
