import { PipelineRun, PipelineRunStep } from "@/types";
import { deduplicates, replaces } from "@/utils/array";
import { equates } from "@/utils/record";
import create from "zustand";
import { jobRunsApi, StatusUpdate, StepStatusUpdate } from "./jobRunsApi";

export type JobRunsApi = {
  /** A list of all the currently fetched runs, in no particular order. */
  runs: PipelineRun[];
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

export const useJobRunsApi = create<JobRunsApi>((set, get) => {
  return {
    runs: [],
    fetch: async (jobUuid, runUuid) => {
      const run = await jobRunsApi.fetch(jobUuid, runUuid).catch(onFetchError);

      if (!run) return;

      set((state) => ({ ...state, runs: replaceRun(state.runs, run) }));
    },
    fetchAll: async (jobUuid) => {
      const runs = await jobRunsApi.fetchAll(jobUuid).catch(onFetchError);

      if (!runs?.length) return;

      set((state) => ({ ...state, runs: deduplicateRuns(runs, state.runs) }));
    },
    cancel: async (jobUuid, runUuid) => {
      await jobRunsApi.cancel(jobUuid, runUuid).catch(onFetchError);
      const run = get().runs.find(equates("uuid", runUuid));

      if (!run) return;

      const updated: PipelineRun = { ...run, status: "ABORTED" };

      set((state) => ({ ...state, runs: replaceRun(state.runs, updated) }));
    },
    setStatus: async (update) => {
      await jobRunsApi.setStatus(update).catch(onFetchError);
      const run = get().runs.find(equates("uuid", update.runUuid));

      if (!run) return;

      const updated: PipelineRun = { ...run, status: update.status };

      set((state) => ({ ...state, runs: replaceRun(state.runs, updated) }));
    },
    setStepStatus: async (update) => {
      await jobRunsApi.setStepStatus(update).catch(onFetchError);
      const run = get().runs.find(equates("uuid", update.runUuid));
      const step = run?.pipeline_steps.find(
        equates("step_uuid", update.stepUuid)
      );

      if (!run || !step) return;

      const updatedStep: PipelineRunStep = { ...step, status: update.status };
      const updatedRun: PipelineRun = {
        ...run,
        pipeline_steps: replaceStep(run.pipeline_steps, updatedStep),
      };

      set((state) => ({ ...state, runs: replaceRun(state.runs, updatedRun) }));
    },
  };
});

const replacesByRunUuid = (uuid: string) =>
  replaces<PipelineRun>(equates("uuid", uuid), "unshift");

const replacesByStepUuid = (uuid: string) =>
  replaces<PipelineRunStep>(equates("step_uuid", uuid), "ignore");

const replaceStep = (
  steps: readonly PipelineRunStep[],
  step: PipelineRunStep
) => replacesByStepUuid(step.step_uuid)(steps, step);

const replaceRun = (runs: readonly PipelineRun[], run: PipelineRun) =>
  replacesByRunUuid(run.uuid)(runs, run);

const deduplicateRuns = deduplicates<PipelineRun>((run) => run.uuid);

const onFetchError = (error: unknown) => {
  console.error(error);
  return null;
};
