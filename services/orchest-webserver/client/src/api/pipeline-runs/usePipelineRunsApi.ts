import { PipelineRun } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { pipelineRunsApi } from "./pipelineRunsApi";

export type PipelineRunsApi = {
  cancel: MemoizePending<(runUuid: string) => Promise<void>>;
  fetchAll: MemoizePending<() => Promise<PipelineRun[]>>;
  runs: PipelineRun[] | undefined;
};

/** State container for interactive pipeline runs. */
export const usePipelineRunsApi = create<PipelineRunsApi>((set) => {
  return {
    runs: undefined,
    cancel: memoizeFor(500, async (runUuid: string) => {
      await pipelineRunsApi.cancel(runUuid);

      set(({ runs }) => ({
        runs: runs?.map((run) =>
          run.uuid === runUuid ? { ...run, status: "ABORTED" } : run
        ),
      }));
    }),
    fetchAll: memoizeFor(500, async () => {
      const runs = await pipelineRunsApi.fetchAll();

      set({ runs });

      return runs;
    }),
  };
});
