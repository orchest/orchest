import { usePipelineRunsApi } from "@/api/pipeline-runs/usePipelineRunsApi";
import { hasValue } from "@orchest/lib-utils";
import { useHydrate } from "./useHydrate";

export const useFetchPipelineRuns = () => {
  const fetchAll = usePipelineRunsApi((api) => api.fetchAll);
  const runs = usePipelineRunsApi((api) => api.runs);
  const state = useHydrate(fetchAll);

  return {
    runs: runs || [],
    /** Whether data has ever been fetched. */
    hasData: hasValue(runs),
    /** Whether there are no runs. */
    isEmpty: runs ? runs.length === 0 : true,
    ...state,
  };
};
