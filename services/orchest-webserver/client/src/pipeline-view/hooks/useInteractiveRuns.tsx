import { pipelineRunsApi } from "@/api/pipeline-runs/pipelineRunsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { PipelineJson } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import {
  createStepRunStates,
  isPipelineIdling,
  isPipelineRunning,
  usePollPipelineRunStatus,
} from "./usePollRunStatus";

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

  const {
    runStatus,
    stepRunStates,
    setStepRunStates,
  } = usePollPipelineRunStatus(jobUuid, runUuid);

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
      if (!pipelineJson || !projectUuid) return;

      try {
        const result = await pipelineRunsApi.runSteps({
          projectUuid,
          stepUuids: uuids,
          pipelineDefinition: pipelineJson,
          type,
        });

        setStepRunStates((current) => ({
          ...current,
          ...createStepRunStates(result),
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
    [pipelineJson, projectUuid, setStepRunStates, setRunUuid, setAlert]
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
    stepRunStates,
    displayedPipelineStatus,
    setDisplayedPipelineStatus,
    executeRun,
  };
};
