import { TStatus } from "@/components/Status";
import { useInterval } from "@/hooks/use-interval";
import { useFetcher } from "@/hooks/useFetcher";
import type { PipelineRun } from "@/types";
import { serverTimeToDate } from "@/utils/webserver-utils";
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

/**
 * a poller hook that checks run status
 */
export const useStepExecutionState = (
  url: string | undefined,
  callback: (status: TStatus) => void
) => {
  const { data = {}, setData, fetchData } = useFetcher<
    PipelineRun,
    StepExecutionStateObj
  >(url, {
    transform: (data) => {
      callback(data.status);
      return convertStepsToObject(data);
    },
    caching: true,
  });

  useInterval(() => {
    fetchData();
  }, STATUS_POLL_FREQUENCY);

  return {
    stepExecutionState: data,
    setStepExecutionState: setData,
  };
};
