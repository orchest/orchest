import { RunStepsType } from "@/api/pipeline-runs/pipelineRunsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useActivePipelineRun } from "@/hooks/useActivePipelineRun";
import { useFetchActivePipelineRun } from "@/hooks/useFetchActivePipelineRun";
import { PipelineJson } from "@/types";
import { isPipelineIdling, isPipelineRunning } from "@/utils/pipeline";
import React from "react";

/**
 * This is a FE-only pipeline status mapping. The actual status from BE does not always fit from user's perspective.
 * For example, BE doesn't have the status "CANCELING".
 */
export type DisplayStatus = "IDLING" | "RUNNING" | "CANCELING";

/**
 * Allows for interaction with the active pipeline run.
 * Supports both Interactive Runs and Job Runs.
 */
export const usePipelineRuns = (pipelineDefinition?: PipelineJson) => {
  const { setAlert } = useGlobalContext();

  const [displayStatus, setDisplayStatus] = React.useState<DisplayStatus>(
    "IDLING"
  );

  const activeRun = useFetchActivePipelineRun();
  const runStatus = activeRun?.status;
  const stepRunStates = useActivePipelineRun((state) => state.stepStates);
  const runSteps = useActivePipelineRun((state) => state.runSteps);

  React.useEffect(() => {
    if (isPipelineRunning(runStatus)) {
      setDisplayStatus("RUNNING");
    } else if (isPipelineIdling(runStatus)) {
      // make sure stale opened files are reloaded in active
      // Jupyter instance
      window.orchest.jupyter?.reloadFilesFromDisk();

      setDisplayStatus("IDLING");
    }
  }, [runStatus]);

  const triggerSteps = React.useCallback(
    async (uuids: string[], type: RunStepsType) => {
      if (!pipelineDefinition) return false;

      return await runSteps({ stepUuids: uuids, pipelineDefinition, type })
        .then(() => true)
        .catch((error) => {
          setAlert("Failed to run steps", <ErrorSummary error={error} />);

          return false;
        });
    },
    [pipelineDefinition, runSteps, setAlert]
  );

  const startRun = React.useCallback(
    async (uuids: string[], type: RunStepsType) => {
      if (displayStatus === "RUNNING") {
        setAlert(
          "Error",
          "The pipeline is currently running, please wait until it completes."
        );
      } else {
        setDisplayStatus("RUNNING");

        const didStart = await triggerSteps(uuids, type);

        if (!didStart) {
          setDisplayStatus("IDLING");
        }
      }
    },
    [triggerSteps, setDisplayStatus, displayStatus, setAlert]
  );

  return { stepRunStates, displayStatus, setDisplayStatus, startRun };
};
