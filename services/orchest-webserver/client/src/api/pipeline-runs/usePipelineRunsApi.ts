import { PipelineRun } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import create from "zustand";
import { pipelineRunsApi } from "./pipelineRunsApi";

export type PipelineRunsApi = {
  running: PipelineRun[] | undefined;
  /** Cancels an (interactive) pipeline run. */
  cancel: MemoizePending<(runUuid: string) => Promise<void>>;
  /** Fetches all running (STARTED/PENDING) pipeline runs for all projects. */
  fetchRunning: MemoizePending<() => Promise<PipelineRun[]>>;
};

/** State container for interactive pipeline runs. */
export const usePipelineRunsApi = create<PipelineRunsApi>((set) => {
  return {
    running: [],
    cancel: memoizeFor(500, async (runUuid: string) => {
      await pipelineRunsApi.cancel(runUuid);

      set(({ running }) => ({
        running: running?.map((run) =>
          run.uuid === runUuid ? { ...run, status: "ABORTED" } : run
        ),
      }));
    }),
    fetchRunning: memoizeFor(500, async () => {
      const running = await pipelineRunsApi.fetchAll({ active: true });

      set({ running });

      return running;
    }),
  };
});
