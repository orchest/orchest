import { usePipelineRunsApi } from "@/api/pipeline-runs/usePipelineRunsApi";
import { hasValue } from "@orchest/lib-utils";
import { useHydrate } from "./useHydrate";

export const useFetchRunningPipelineRuns = () => {
  const fetchRunning = usePipelineRunsApi((api) => api.fetchRunning);
  const running = usePipelineRunsApi((api) => api.running);
  const state = useHydrate(fetchRunning);

  return {
    running: running || [],
    /** Whether data has ever been fetched. */
    hasData: hasValue(running),
    /** Whether there are no runs. */
    isEmpty: running ? running.length === 0 : true,
    ...state,
  };
};
