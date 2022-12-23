import { usePipelineRunsApi } from "@/api/pipeline-runs/usePipelineRunsApi";
import { PipelineRun } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useRegainBrowserTabFocus } from "./useFocusBrowserTab";

export const useFetchPipelineRuns = () => {
  const { run, status, error } = useAsync<PipelineRun[]>();
  const init = usePipelineRunsApi((api) => api.fetchAll);
  const runs = usePipelineRunsApi((api) => api.runs);

  const refresh = React.useCallback(() => run(init()), [init, run]);

  const tabRegainedFocus = useRegainBrowserTabFocus();

  React.useEffect(() => {
    if (!tabRegainedFocus) return;
    if (status !== "RESOLVED") return;

    refresh();
  }, [refresh, tabRegainedFocus, status]);

  React.useEffect(() => void refresh(), [refresh]);

  return {
    runs: runs || [],
    /** Whether data is currently being fetched. */
    isFetching: status === "PENDING",
    /** Whether fetching has completed. */
    isFetched: status === "RESOLVED",
    /** Whether data has ever been fetched. */
    hasData: hasValue(runs),
    /** Whether there are some runs. */
    isEmpty: runs ? runs.length === 0 : true,
    refresh,
    error,
  };
};
