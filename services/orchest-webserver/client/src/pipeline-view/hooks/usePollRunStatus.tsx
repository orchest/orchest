import { jobRunsApi } from "@/api/job-runs/jobRunsApi";
import { pipelineRunsApi } from "@/api/pipeline-runs/pipelineRunsApi";
import { useAsync } from "@/hooks/useAsync";
import { useInterval } from "@/hooks/useInterval";
import type { PipelineRun, PipelineRunStatus } from "@/types";
import { serverTimeToDate } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ExecutionState } from "../PipelineStep";

/** Step run states by Step UUID. */
export type StepRunStates = Record<string, ExecutionState>;

export const createStepRunStates = (run: PipelineRun) =>
  Object.fromEntries(
    run.pipeline_steps.map((step) => [
      step.step_uuid,
      {
        started_time: serverTimeToDate(step.started_time),
        finished_time: serverTimeToDate(step.finished_time),
        server_time: serverTimeToDate(run.server_time),
        status: step.status,
      },
    ])
  );

export const PIPELINE_RUNNING_STATES: readonly PipelineRunStatus[] = [
  "PENDING",
  "STARTED",
];

export const PIPELINE_IDLING_STATES: readonly PipelineRunStatus[] = [
  "SUCCESS",
  "ABORTED",
  "FAILURE",
];

export const isPipelineRunning = (runStatus?: PipelineRunStatus) =>
  hasValue(runStatus) && PIPELINE_RUNNING_STATES.includes(runStatus);

export const isPipelineIdling = (runStatus?: PipelineRunStatus) =>
  hasValue(runStatus) && PIPELINE_IDLING_STATES.includes(runStatus);

const STATUS_POLL_FREQUENCY = 1000;

/**
 * A poller hook that checks status of
 * the Pipeline Run and Steps while the Pipeline is running.
 *
 * Works for both interactive & job runs.
 * @param jobUuid The ID of the Job to use. Set to `undefined` for interactive runs.
 * @param runUuid The ID of the run to use: can be either an interactive run or job run if `jobUuid` is set.
 *  Set to `undefined` to disable polling.
 */
export const usePollPipelineRunStatus = (
  jobUuid: string | undefined,
  runUuid: string | undefined
) => {
  const [runStatus, setRunStatus] = React.useState<PipelineRunStatus>();
  const [stepRunStates, setStepRunStates] = React.useState<StepRunStates>();
  const { data: pipelineRun, run } = useAsync<PipelineRun>();
  const isRunning = isPipelineRunning(runStatus);

  const refresh = React.useCallback(() => {
    if (jobUuid && runUuid) {
      run(jobRunsApi.fetchOne(jobUuid, runUuid));
    } else if (runUuid) {
      run(pipelineRunsApi.fetchOne(runUuid));
    }
  }, [jobUuid, runUuid, run]);

  React.useEffect(refresh, [refresh]);

  React.useEffect(() => {
    if (pipelineRun) {
      setRunStatus(pipelineRun.status);
      setStepRunStates(createStepRunStates(pipelineRun));
    }
  }, [pipelineRun]);

  useInterval(refresh, isRunning ? STATUS_POLL_FREQUENCY : undefined);

  return { runStatus, stepRunStates, setStepRunStates };
};
