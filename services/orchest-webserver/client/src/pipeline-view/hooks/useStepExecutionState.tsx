import { TStatus } from "@/components/Status";
import { useFetcher } from "@/hooks/useFetcher";
import { useInterval } from "@/hooks/useInterval";
import type { PipelineRun } from "@/types";
import { serverTimeToDate } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ExecutionState } from "../PipelineStep";

const STATUS_POLL_FREQUENCY = 500;

type StepExecutionStateObj = Record<string, ExecutionState>;

export const convertStepsToObject = (pipelineRun: PipelineRun) => {
  return pipelineRun.pipeline_steps.reduce((all, step) => {
    const { started_time, finished_time } = step;
    return {
      ...all,
      [step.step_uuid]: {
        started_time: serverTimeToDate(started_time),
        finished_time: serverTimeToDate(finished_time),
        server_time: serverTimeToDate(pipelineRun.server_time),
        status: step.status,
      },
    };
  }, {} as StepExecutionStateObj);
};

export const PIPELINE_RUNNING_STATES: Partial<TStatus>[] = [
  "PENDING",
  "STARTED",
];

export const PIPELINE_IDLING_STATES: Partial<TStatus>[] = [
  "SUCCESS",
  "ABORTED",
  "FAILURE",
];

export const isPipelineRunning = (runStatus?: TStatus) =>
  hasValue(runStatus) && PIPELINE_RUNNING_STATES.includes(runStatus);

export const isPipelineIdling = (runStatus?: TStatus) =>
  hasValue(runStatus) && PIPELINE_IDLING_STATES.includes(runStatus);

/**
 * A poller hook that checks run status. It only polls if pipeline is running.
 */
export const useStepExecutionState = (url: string | undefined) => {
  const [runStatus, setRunStatus] = React.useState<TStatus>();
  const {
    data: stepExecutionState,
    setData: setStepExecutionState,
    fetchData,
  } = useFetcher<PipelineRun, StepExecutionStateObj>(url, {
    transform: (data) => {
      setRunStatus(data.status);
      return convertStepsToObject(data);
    },
    revalidateOnFocus: true,
  });

  const shouldPoll = isPipelineRunning(runStatus);

  useInterval(
    () => {
      fetchData();
    },
    shouldPoll ? STATUS_POLL_FREQUENCY : undefined
  );

  return {
    runStatus,
    stepExecutionState,
    setStepExecutionState,
  };
};
