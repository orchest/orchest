import { PipelineRun } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { pipelineRunsApi } from "./pipelineRunsApi";

export type PipelineRunsApi = {
  fetchAll: MemoizePending<() => Promise<PipelineRun[]>>;
  runs: PipelineRun[] | undefined;
};

/** State container for interactive pipeline runs. */
export const usePipelineRunsApi = create<PipelineRunsApi>((set) => {
  return {
    runs: undefined,
    fetchAll: memoizeFor(500, async () => {
      const runs = await pipelineRunsApi.fetchAll();

      set({ runs });

      return runs;
    }),
  };
});
