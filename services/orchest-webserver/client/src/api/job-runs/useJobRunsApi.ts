import { TStatus } from "@/components/Status";
import { isCancelledPromiseError } from "@/hooks/useCancelablePromise";
import { PipelineRun } from "@/types";
import { replaces } from "@/utils/array";
import { equates } from "@/utils/record";
import produce from "immer";
import create from "zustand";
import { jobRunsApi, StatusUpdate, StepStatusUpdate } from "./jobRunsApi";

export type JobRunsApi = {
  /** A list of all the currently fetched runs, in no particular order. */
  runs: PipelineRun[] | undefined;
  /** Fetches all runs for a given job and adds it to `runs`. */
  fetchAll: (jobUuid: string) => Promise<void>;
  /** Fetches a single run and adds it to `runs`. */
  fetch: (jobUuid: string, runUuid: string) => Promise<void>;
  /** Cancels a job run and updates the  it in `runs` (if it includes it). */
  cancel: (jobUuid: string, runUuid: string) => Promise<void>;
  /** Updates the status of a job run and updates it in `runs` (if it includes it). */
  setStatus: (update: StatusUpdate) => Promise<void>;
  /** Updates the status of a job run step and updates it in `runs` (if it includes it). */
  setStepStatus: (update: StepStatusUpdate) => Promise<void>;
};

export const useJobRunsApi = create<JobRunsApi>((set) => {
  const setRunStatus = (runUuid: string, status: TStatus) => {
    set((state) => ({
      runs: produce(state.runs || [], (draft) => {
        const runIndex = draft.findIndex((run) => run.uuid === runUuid);
        if (runIndex === -1) return;
        draft[runIndex].status = status;
      }),
    }));
  };

  return {
    runs: undefined,
    fetch: async (jobUuid, runUuid) => {
      const run = await jobRunsApi.fetch(jobUuid, runUuid);

      if (!run) return;

      set((state) => ({ runs: replaceRun(state.runs, run) }));
    },
    fetchAll: async (jobUuid) => {
      const runs = await jobRunsApi.fetchAll(jobUuid);

      if (!runs) return;

      set({ runs });
    },
    cancel: async (jobUuid, runUuid) => {
      await jobRunsApi.cancel(jobUuid, runUuid);
      setRunStatus(runUuid, "ABORTED");
    },
    setStatus: async (update) => {
      await jobRunsApi.setStatus(update);
      setRunStatus(update.runUuid, update.status);
    },
    setStepStatus: async (update) => {
      await jobRunsApi.setStepStatus(update);

      set((state) => {
        return {
          runs: produce(state.runs || [], (draft) => {
            const runIndex =
              draft.findIndex((run) => run.uuid === update.runUuid) ?? -1;

            const stepIndex =
              draft[runIndex]?.pipeline_steps.findIndex(
                (step) => step.step_uuid === update.stepUuid
              ) ?? -1;

            if (runIndex === -1 || stepIndex === -1) return;

            draft[runIndex].pipeline_steps[stepIndex].status = update.status;
          }),
        };
      });
    },
  };
});

const replacesByRunUuid = (uuid: string) =>
  replaces<PipelineRun>(equates("uuid", uuid), "unshift");

const replaceRun = (
  runs: readonly PipelineRun[] | undefined,
  run: PipelineRun
) => replacesByRunUuid(run.uuid)(runs || [], run);

export const onFetchError = (error: any) => {
  if (!isCancelledPromiseError(error)) {
    console.error(error);
  }
};
