import { defineStoreScope } from "@/store/scoped";
import { PipelineRun, PipelineRunStatus } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import { jobRunsApi } from "./jobRunsApi";

export type ActiveJobRunApi = {
  /**
   * The currently active job run. Hydrated by `fetchActive`.
   *
   * Note: This is automatically cleared when `runUuid` changes.
   */
  run: PipelineRun | undefined;
  /**
   * Fetches the currently active job run as defined by `runUuid` in the current scope.
   *
   * Note: Throws if `runUuid` is not available.
   */
  fetch: MemoizePending<() => Promise<void>>;
  /** Cancels a active job run and updates the local state if successful. */
  cancel: () => Promise<void>;
  /**
   * Updates the status of the active job run in the back-end,
   * and updates the local state if successful.
   */
  setStatus: (update: PipelineRunStatus) => Promise<void>;
};

const create = defineStoreScope({
  requires: ["jobUuid"],
  additional: ["runUuid"],
});

export const useActiveJobRunApi = create<ActiveJobRunApi>(
  (set, get, { subscribe }) => {
    subscribe((state) => {
      if (state.run && state.runUuid !== state.run.uuid) {
        set({ run: undefined });
      }
    });

    const updateStatus = async (runUuid: string, status: PipelineRunStatus) => {
      set(({ run }) => ({
        run: run && run.uuid === runUuid ? { ...run, status } : run,
      }));
    };

    return {
      run: undefined,
      fetch: memoizeFor(1000, async () => {
        const { jobUuid, runUuid } = get();

        if (!runUuid) {
          throw new Error("A `runUuid` is not defined in the current scope.");
        }

        set({ run: await jobRunsApi.fetchOne(jobUuid, runUuid) });
      }),
      setStatus: async (status) => {
        const { jobUuid, runUuid } = get();

        if (!runUuid) return;

        await jobRunsApi.setStatus({ runUuid, jobUuid, status });

        updateStatus(runUuid, status);
      },
      cancel: async () => {
        const { jobUuid, runUuid } = get();

        if (!runUuid) return;

        await jobRunsApi.cancel(jobUuid, runUuid);

        updateStatus(runUuid, "ABORTED");
      },
    };
  }
);
