import { RunStepsType } from "@/api/pipeline-runs/pipelineRunsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { useActivePipelineRun } from "@/hooks/useActivePipelineRun";
import { useCancelJobRun } from "@/hooks/useCancelJobRun";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useAutoStartSession } from "./useAutoStartSession";
import { usePipelineRuns } from "./usePipelineRuns";

export const useInteractiveRuns = () => {
  const { setConfirm, setAlert } = useGlobalContext();
  const { pipelineJson } = usePipelineDataContext();
  const { session, startSession } = useAutoStartSession();
  const cancel = useActivePipelineRun((state) => state.cancel);
  const cancelJobRun = useCancelJobRun(cancel);
  const isJobRun = useActivePipelineRun((state) => state.isJobRun);
  const isSessionRunning = session?.status === "RUNNING";

  const {
    stepRunStates,
    displayStatus,
    setDisplayStatus,
    startRun,
  } = usePipelineRuns(pipelineJson);

  const cancelRun = React.useCallback(async () => {
    if (displayStatus === "IDLING") {
      console.error("There is no pipeline running.");
      return;
    } else if (displayStatus === "CANCELING") {
      console.error("A cancelling run operation in progress.");
      return;
    }

    setDisplayStatus("CANCELING");

    if (isJobRun()) {
      cancelJobRun();
    } else {
      await cancel().catch((error) =>
        setAlert(
          "Failed to cancel pipeline run",
          <ErrorSummary error={error} />
        )
      );
    }
  }, [
    displayStatus,
    isJobRun,
    cancelJobRun,
    setDisplayStatus,
    cancel,
    setAlert,
  ]);

  const runSteps = React.useCallback(
    (uuids: string[], type: RunStepsType) => {
      if (uuids.length === 0) return;
      if (!isSessionRunning && pipelineJson) {
        setConfirm(
          "Notice",
          "An active session is required to execute an interactive run. Do you want to start the session first?",
          (resolve) => {
            startSession(pipelineJson.uuid, BUILD_IMAGE_SOLUTION_VIEW.PIPELINE);
            resolve(true);
            return true;
          }
        );
        return;
      }

      startRun(uuids, type);
    },
    [startRun, setConfirm, startSession, isSessionRunning, pipelineJson]
  );

  return {
    stepRunStates,
    displayStatus,
    setDisplayStatus,
    startRun,
    cancelRun,
    runSteps,
    session,
  };
};
