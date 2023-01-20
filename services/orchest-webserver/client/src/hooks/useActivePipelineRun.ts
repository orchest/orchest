import { jobRunsApi } from "@/api/job-runs/jobRunsApi";
import {
  pipelineRunsApi,
  StepStatusQuery,
} from "@/api/pipeline-runs/pipelineRunsApi";
import { defineStoreScope } from "@/store/scoped";
import { PipelineRun, PipelineStepStatus } from "@/types";
import { isPipelineRunning } from "@/utils/pipeline";
import { memoized, MemoizePending } from "@/utils/promise";
import { equalsShallow } from "@/utils/record";
import { serverTimeToDate } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";

export type StepRunState = {
  finished_time?: Date;
  server_time?: Date;
  started_time?: Date;
  status: PipelineStepStatus;
};

/** Step run states by Step UUID. */
export type StepRunStates = Record<string, StepRunState>;

const additionalScopeProps = ["runUuid", "jobUuid", "pipelineUuid"] as const;

const create = defineStoreScope({
  requires: ["projectUuid"],
  additional: additionalScopeProps,
});

export type RunStepsQuery = Omit<StepStatusQuery, "projectUuid">;

export type ActiveRunApi = {
  /** The currently active run (if fetched). */
  run: PipelineRun | undefined;
  /** The state of each Step, keyed by Step UUID.  */
  stepStates: StepRunStates | undefined;
  /** For interactive runs: runs the provided steps. */
  runSteps: MemoizePending<(query: RunStepsQuery) => Promise<void>>;
  /**
   * Fetches the active run based on available scope parameters.
   * - If `jobUuid` and `runUuid` is available, a job run is fetched.
   * - Otherwise; if only `runUuid` is available, an interactive run is fetched.
   * - Otherwise; if `pipelineUuid` and `projectUuid` is available, the latest interactive run is fetched.
   * - Otherwise; nothing is fetched.
   */
  fetch: MemoizePending<() => Promise<void>>;
  /** Returns true if the run is from a Job */
  isJobRun: () => boolean;
  /** Cancels the active run (if it is running) */
  cancel: () => Promise<void>;
};

const STATUS_POLL_FREQUENCY = 1000;

/**
 * Allows fetching, canceling and monitoring of the active pipeline run.
 * While the active Pipeline is running, the store will automatically poll
 * the back-end to keep track of its current status.
 *
 * This store supports both Interactive Runs and Job Runs.
 */
export const useActivePipelineRun = create<ActiveRunApi>(
  (set, get, { subscribe }) => {
    let pollHandle = -1;

    subscribe(function startPolling(state, prev) {
      if (state.run === prev.run) return;

      window.clearInterval(pollHandle);

      if (isPipelineRunning(state.run?.status)) {
        pollHandle = window.setInterval(state.fetch, STATUS_POLL_FREQUENCY);
      }
    });

    subscribe(function stopPolling(state) {
      if (!hasValue(state?.run) || !isPipelineRunning(state.run.status)) {
        window.clearInterval(pollHandle);
      }
    });

    subscribe(function updateStepStates(state, prev) {
      if (hasValue(state.run) && state.run !== prev.run) {
        set({ stepStates: createStepRunStates(state.run) });
      } else if (hasValue(state.stepStates) && !state.run) {
        set({ stepStates: undefined });
      }
    });

    subscribe(function clearRun(state, prev) {
      if (!equalsShallow(state, prev, additionalScopeProps)) {
        set({ run: undefined });
      }
    });

    const fetchBestPipelineRun = async () => {
      const state = get();
      const runUuid = state.run?.uuid ?? state.runUuid;

      if (state.jobUuid && runUuid) {
        return await jobRunsApi.fetchOne(state.jobUuid, runUuid);
      } else if (runUuid) {
        return await pipelineRunsApi.fetchOne(runUuid);
      } else if (state.pipelineUuid) {
        return await pipelineRunsApi
          .fetchAll({
            projectUuid: state.projectUuid,
            pipelineUuid: state.pipelineUuid,
          })
          .then((runs) => runs[0]);
      } else {
        return undefined;
      }
    };

    return {
      run: undefined,
      stepStates: undefined,
      runSteps: memoized(async (query: RunStepsQuery) => {
        set({
          run: await pipelineRunsApi.runSteps({
            ...query,
            projectUuid: get().projectUuid,
          }),
        });
      }),
      fetch: memoized(async () => {
        set({ run: await fetchBestPipelineRun() });
      }),
      isJobRun: () => hasValue(get().jobUuid),
      cancel: async () => {
        const state = get();
        const runUuid = state.run?.uuid ?? state.runUuid;

        if (!runUuid || !isPipelineRunning(state.run?.status)) return;

        if (state.jobUuid) {
          await jobRunsApi.cancel(state.jobUuid, runUuid);
        } else {
          await pipelineRunsApi.cancel(runUuid);
        }

        set(({ run }) => ({
          run: run ? { ...run, status: "ABORTED" } : run,
        }));
      },
    };
  }
);

export const createStepRunStates = (run: PipelineRun) =>
  Object.fromEntries(
    run.pipeline_steps.map((step) => [
      step.step_uuid,
      {
        started_time: serverTimeToDate(step.started_time),
        finished_time: serverTimeToDate(step.finished_time),
        server_time: serverTimeToDate(run.server_time),
        status:
          run.status === "ABORTED"
            ? hasStepRunEnded(step.status)
              ? step.status
              : "ABORTED"
            : step.status,
      },
    ])
  );

const hasStepRunEnded = (status: PipelineStepStatus) =>
  status === "FAILURE" || status === "SUCCESS";
