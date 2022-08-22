import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { PipelineJson, PipelineRun } from "@/types";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import {
  PIPELINE_JOBS_STATUS_ENDPOINT,
  PIPELINE_RUN_STATUS_ENDPOINT,
} from "../common";
import {
  convertStepsToObject,
  isPipelineIdling,
  isPipelineRunning,
  useStepExecutionState,
} from "./useStepExecutionState";

export type RunStepsType = "selection" | "incoming";

/**
 * This is a FE-only pipeline status mapping. The actual status from BE does not always fit from user's perspective.
 * For example, BE doesn't have the status "CANCELING".
 */
export type DisplayedPipelineStatus = "IDLING" | "RUNNING" | "CANCELING";

export const useInteractiveRuns = ({
  projectUuid,
  runUuid,
  setRunUuid,
  pipelineJson,
}: {
  projectUuid?: string;
  runUuid?: string;
  setRunUuid: React.Dispatch<React.SetStateAction<string | undefined>>;
  pipelineJson?: PipelineJson;
}) => {
  const { jobUuid } = useCustomRoute();
  const { setAlert } = useGlobalContext();

  const [displayedPipelineStatus, setDisplayedPipelineStatus] = React.useState<
    DisplayedPipelineStatus
  >("IDLING");

  const runStatusEndpoint = jobUuid
    ? `${PIPELINE_JOBS_STATUS_ENDPOINT}/${jobUuid}`
    : PIPELINE_RUN_STATUS_ENDPOINT;

  const {
    runStatus,
    stepExecutionState,
    setStepExecutionState,
  } = useStepExecutionState(
    runUuid ? `${runStatusEndpoint}/${runUuid}` : undefined
  );

  React.useEffect(() => {
    if (!hasValue(runStatus)) return;
    if (isPipelineRunning(runStatus)) {
      setDisplayedPipelineStatus("RUNNING");
    }
    if (isPipelineIdling(runStatus)) {
      // make sure stale opened files are reloaded in active
      // Jupyter instance
      window.orchest.jupyter?.reloadFilesFromDisk();
      setDisplayedPipelineStatus("IDLING");
    }
  }, [runStatus]);

  const executePipelineSteps = React.useCallback(
    async (uuids: string[], type: RunStepsType) => {
      if (!pipelineJson) return;
      try {
        const result = await fetcher<PipelineRun>(
          PIPELINE_RUN_STATUS_ENDPOINT,
          {
            method: "POST",
            headers: HEADER.JSON,
            body: JSON.stringify({
              uuids: uuids,
              project_uuid: projectUuid,
              run_type: type,
              pipeline_definition: pipelineJson,
            }),
          }
        );

        setStepExecutionState((current) => ({
          ...current,
          ...convertStepsToObject(result),
        }));
        setRunUuid(result.uuid);
        return true;
      } catch (error) {
        setAlert(
          "Error",
          `Failed to start interactive run. ${error.message || "Unknown error"}`
        );
        return false;
      }
    },
    [projectUuid, setStepExecutionState, setAlert, pipelineJson, setRunUuid]
  );

  const executeRun = React.useCallback(
    async (uuids: string[], type: RunStepsType) => {
      if (displayedPipelineStatus === "RUNNING") {
        setAlert(
          "Error",
          "The pipeline is currently executing, please wait until it completes."
        );
        return;
      }
      setDisplayedPipelineStatus("RUNNING");
      const executionStarted = await executePipelineSteps(uuids, type);
      if (!executionStarted) setDisplayedPipelineStatus("IDLING");
    },
    [
      executePipelineSteps,
      setDisplayedPipelineStatus,
      displayedPipelineStatus,
      setAlert,
    ]
  );

  return {
    stepExecutionState,
    displayedPipelineStatus,
    setDisplayedPipelineStatus,
    executeRun,
  };
};
