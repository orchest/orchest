import { createJobStore } from "@/store/scoped";
import { JobRunsPage, PipelineRun, PipelineRunStatus } from "@/types";
import { choke } from "@/utils/promise";
import { jobRunsApi, JobRunsPageQuery, StatusUpdate } from "./jobRunsApi";

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
  fetchPage: (query: JobRunsPageQuery) => Promise<void>;
  /** Cancels a job run and updates the it in `runs` & `page` (if it includes it). */
  cancel: (runUuid: string) => Promise<void>;
  /** Updates the status of a job run in the back-end and updates it in `runs` & `page` (if it includes it). */
  setStatus: (update: StatusUpdate) => Promise<void>;
};

/** A state container for job runs within the active job scope. */
export const useJobRunsApi = createJobStore<JobRunsApi>((set, get) => {
  const setRunStatus = (
    runs: PipelineRun[],
    runUuid: string,
    status: PipelineRunStatus
  ) => runs.map((run) => (run.uuid === runUuid ? { ...run, status } : run));

  const replaceOrAddRun = (
    runs: PipelineRun[] | undefined,
    newRun: PipelineRun
  ) => {
    if (runs?.find((run) => run.uuid === newRun.uuid)) {
      return runs?.map((run) => (run.uuid === newRun.uuid ? newRun : run));
    } else {
      return [...(runs || []), newRun];
    }
  };

  const updateStatus = (runUuid: string, status: PipelineRunStatus) => {
    set((state) => ({
      runs: state.runs ? setRunStatus(state.runs, runUuid, status) : state.runs,
      page: state.page
        ? {
            ...state.page,
            pipeline_runs: setRunStatus(
              state.page.pipeline_runs,
              runUuid,
              status
            ),
          }
        : state.page,
    }));
  };

  return {
    page: undefined,
    runs: undefined,
    fetchOne: choke(async (runUuid) => {
      const newRun = await jobRunsApi.fetchOne(get().jobUuid, runUuid);

      set((state) => ({ runs: replaceOrAddRun(state.runs, newRun) }));
    }),
    fetchPage: choke(async (query) => {
      set({ page: await jobRunsApi.fetchPage(get().jobUuid, query) });
    }),
    fetchAll: choke(async () => {
      set({ runs: await jobRunsApi.fetchAll(get().jobUuid) });
    }),
    cancel: async (runUuid) => {
      await jobRunsApi.cancel(get().jobUuid, runUuid);

      updateStatus(runUuid, "ABORTED");
    },
    setStatus: async (update) => {
      await jobRunsApi.setStatus(update);

      updateStatus(update.runUuid, update.status);
    },
  };
});
