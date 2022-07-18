import { useAppContext } from "@/contexts/AppContext";
import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { OrchestSession } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";
import { useAutoStartSession } from "../hooks/useAutoStartSession";
import { RunStepsType, useInteractiveRuns } from "../hooks/useInteractiveRuns";
import { usePipelineDataContext } from "./PipelineDataContext";

export type InteractiveRunsContextType = ReturnType<
  typeof useInteractiveRuns
> & {
  cancelRun: ({
    jobUuid,
    runUuid,
  }: {
    jobUuid?: string | undefined;
    runUuid?: string | undefined;
  }) => Promise<void>;
  runSteps: (uuids: string[], type: RunStepsType) => void;
  session: OrchestSession | undefined;
};

export const InteractiveRunsContext = React.createContext<
  InteractiveRunsContextType
>({} as InteractiveRunsContextType);

export const useInteractiveRunsContext = () =>
  React.useContext(InteractiveRunsContext);

export const InteractiveRunsContextProvider: React.FC = ({ children }) => {
  const { setConfirm, setAlert } = useAppContext();

  const {
    projectUuid,
    pipelineJson,
    runUuid,
    setRunUuid,
    isReadOnly,
  } = usePipelineDataContext();
  const { session, startSession } = useAutoStartSession({ isReadOnly });
  const isSessionRunning = session?.status === "RUNNING";

  const {
    stepExecutionState,
    displayedPipelineStatus,
    setDisplayedPipelineStatus,
    executeRun,
  } = useInteractiveRuns({ projectUuid, runUuid, setRunUuid, pipelineJson });

  const cancelRun = React.useCallback(
    async ({ jobUuid, runUuid }: { jobUuid?: string; runUuid?: string }) => {
      if (displayedPipelineStatus === "IDLING") {
        console.error("There is no pipeline running.");
        return;
      }
      if (displayedPipelineStatus === "CANCELING") {
        console.error("A cancelling run operation in progress.");
        return;
      }
      // Double-check if user attempts to cancel a job run.
      if (jobUuid && runUuid) {
        setConfirm(
          "Warning",
          "Are you sure that you want to cancel this job run?",
          async (resolve) => {
            setDisplayedPipelineStatus("CANCELING");
            try {
              await fetcher(`/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`, {
                method: "DELETE",
              });
              resolve(true);
            } catch (error) {
              setAlert("Error", `Failed to cancel this job run.`);
              resolve(false);
            }
            return true;
          }
        );
        return;
      }

      try {
        setDisplayedPipelineStatus("CANCELING");
        await fetcher(`${PIPELINE_RUN_STATUS_ENDPOINT}/${runUuid}`, {
          method: "DELETE",
        });
      } catch (error) {
        setAlert(
          "Error",
          `Could not cancel pipeline run for runUuid ${runUuid}`
        );
      }
    },
    [setAlert, setConfirm, setDisplayedPipelineStatus, displayedPipelineStatus]
  );

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

      executeRun(uuids, type);
    },
    [executeRun, setConfirm, startSession, isSessionRunning, pipelineJson]
  );

  return (
    <InteractiveRunsContext.Provider
      value={{
        stepExecutionState,
        displayedPipelineStatus,
        setDisplayedPipelineStatus,
        executeRun,
        cancelRun,
        runSteps,
        session,
      }}
    >
      {children}
    </InteractiveRunsContext.Provider>
  );
};
