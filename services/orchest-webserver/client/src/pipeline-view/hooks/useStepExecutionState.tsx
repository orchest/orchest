import { TStatus } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import type { PipelineRun } from "@/types";
import { serverTimeToDate } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback, useSWRConfig } from "swr";
import { ExecutionState } from "../PipelineStep";

const STATUS_POLL_FREQUENCY = 1000;

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
  url: string | null,
  callback: (status: TStatus) => void
) => {
  const { cache } = useSWRConfig();
  const { data = {}, error, mutate } = useSWR<StepExecutionStateObj>(
    url,
    (url) =>
      fetcher<PipelineRun>(url).then((result) => {
        callback(result.status);
        return convertStepsToObject(result);
      }),
    { refreshInterval: STATUS_POLL_FREQUENCY }
  );

  const { setAlert } = useAppContext();

  React.useEffect(() => {
    if (error) {
      console.error(error);
      setAlert("Error", "Unable to fetch step status.");
    }
  }, [error, setAlert]);

  const setStepExecutionState = React.useCallback(
    (
      data?:
        | StepExecutionStateObj
        | Promise<StepExecutionStateObj>
        | MutatorCallback<StepExecutionStateObj>
    ) => mutate(data, false),
    [mutate]
  );

  return {
    stepExecutionState: data || cache.get(url),
    setStepExecutionState,
  };
};
