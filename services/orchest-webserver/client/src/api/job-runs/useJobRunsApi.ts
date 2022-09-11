import { TStatus } from "@/components/Status";
import { createJobStore } from "@/store/scoped";
import { JobRunsPage, PipelineRun } from "@/types";
import { choke } from "@/utils/promise";
import produce from "immer";
import { jobRunsApi, StatusUpdate, StepStatusUpdate } from "./jobRunsApi";

export type JobRunsApi = {
  /** A list of all the currently fetched runs, in no particular order. */
  runs: PipelineRun[] | undefined;
  /** The currently fetched page. */
  page: JobRunsPage | undefined;
  /** Fetches all runs for the current job and adds it to `runs`. */
  fetchAll: () => Promise<void>;
  /** Fetches a single job run and adds (or replaces) it in `runs`. */
  fetchOne: (runUuid: string) => Promise<void>;
  /** Fetches a job runs page and updates the `page` property. */
  fetchPage: (page: number, pageSize?: number) => Promise<void>;
  /** Cancels a job run and updates the it in `runs` (if it includes it). */
  cancel: (runUuid: string) => Promise<void>;
  /** Updates the status of a job run in the back-end and updates it in `runs` (if it includes it). */
  setStatus: (update: StatusUpdate) => Promise<void>;
  /** Updates the status of a job run step in the back-end and updates it in `runs` (if it includes it). */
  setStepStatus: (update: StepStatusUpdate) => Promise<void>;
};

/** A state container for job runs within the active job scope. */
export const useJobRunsApi = createJobStore<JobRunsApi>((set, get) => {
  const setRunStatus = (runUuid: string, status: TStatus) =>
    set((state) => ({
      runs: produce(state.runs || [], (draft) => {
        draft.forEach(
          (run) => (run.status = run.uuid === runUuid ? status : run.status)
        );
      }),
    }));

  const replaceOrAddRun = (newRun: PipelineRun) => {
    const { runs = [] } = get();

    if (runs.find((run) => run.uuid === newRun.uuid)) {
      return runs?.map((run) => (run.uuid === newRun.uuid ? newRun : run));
    } else {
      return [...runs, newRun];
    }
  };

  return {
    runs: undefined,
    page: undefined,
    fetchOne: choke(async (runUuid) => {
      const newRun = await jobRunsApi.fetchOne(get().jobUuid, runUuid);

      set({ runs: replaceOrAddRun(newRun) });
    }),
    fetchPage: choke(async (page, pageSize = 10) => {
      set({
        page: await jobRunsApi.fetchPage(get().jobUuid, { page, pageSize }),
      });
    }),
    fetchAll: choke(async () => {
      set({
        runs: await jobRunsApi.fetchAll(get().jobUuid),
      });
    }),
    cancel: async (runUuid) => {
      await jobRunsApi.cancel(get().jobUuid, runUuid);

      setRunStatus(runUuid, "ABORTED");
    },
    setStatus: async (update) => {
      await jobRunsApi.setStatus(update);

      setRunStatus(update.runUuid, update.status);
    },
    setStepStatus: async (update) => {
      await jobRunsApi.setStepStatus(update);

      set((state) => ({
        runs: produce(state.runs || [], (draft) => {
          const step = draft
            .find((run) => run.uuid === update.runUuid)
            ?.pipeline_steps.find((step) => step.step_uuid === update.stepUuid);

          if (step) step.status = update.status;
        }),
      }));
    },
  };
});
