import { RunStepsType } from "@/api/pipeline-runs/pipelineRunsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useActivePipelineRun } from "@/hooks/useActivePipelineRun";
import { useCancelPipelineRun } from "@/hooks/useCancelPipelineRun";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRuns } from "./usePipelineRuns";

export const useInteractiveRuns = () => {
  const { setConfirm, setAlert } = useGlobalContext();
  const { pipelineJson, pipeline } = usePipelineDataContext();
  const { getSession, startSession } = useSessionsContext();

  const session = React.useMemo(() => {
    return getSession(pipeline?.uuid);
  }, [getSession, pipeline?.uuid]);

  const activeRun = useActivePipelineRun((api) => api.run);
  const cancelActiveRun = useCancelPipelineRun(activeRun);
  const isSessionRunning = session?.status === "RUNNING";

  const {
    stepRunStates,
    displayStatus,
    setDisplayStatus,
    startRun,
  } = usePipelineRuns(pipelineJson);

  const cancelActiveRunWithGuards = React.useCallback(async () => {
    if (displayStatus === "IDLING") {
      console.error("There is no pipeline running.");
      return;
    } else if (displayStatus === "CANCELING") {
      console.error("A cancelling run operation in progress.");
      return;
    }

    setDisplayStatus("CANCELING");

    cancelActiveRun()?.catch((error) =>
      setAlert("Failed to cancel run", <ErrorSummary error={error} />)
    );
  }, [displayStatus, setDisplayStatus, cancelActiveRun, setAlert]);

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
    cancelActiveRun: cancelActiveRunWithGuards,
    runSteps,
    session,
  };
};
