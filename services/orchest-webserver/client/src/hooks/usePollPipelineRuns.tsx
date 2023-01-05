import React from "react";
import { useFetchPipelineRuns } from "./useFetchPipelineRuns";

const POLL_TIMEOUT = 5000;

export const usePollPipelineRuns = () => {
  const { runs, refresh } = useFetchPipelineRuns();

  React.useEffect(() => {
    const handle = window.setInterval(() => {
      refresh();
    }, POLL_TIMEOUT);

    return () => window.clearInterval(handle);
  }, [refresh]);

  return { runs };
};
