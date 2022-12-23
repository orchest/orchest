import React from "react";
import { useFetchPipelineRuns } from "./useFetchPipelineRuns";

export const usePollPipelineRuns = (timeout: number) => {
  const { runs, refresh } = useFetchPipelineRuns();

  React.useEffect(() => {
    const handle = window.setInterval(() => {
      refresh();
    }, timeout);

    return () => window.clearInterval(handle);
  }, [refresh, timeout]);

  return { runs };
};
