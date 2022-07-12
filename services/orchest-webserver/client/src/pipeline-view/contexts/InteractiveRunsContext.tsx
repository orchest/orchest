import { useAppContext } from "@/contexts/AppContext";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";
import { RunStepsType, useInteractiveRuns } from "../hooks/useInteractiveRuns";

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
  runSteps: (
    uuids: string[],
    type: RunStepsType,
    isSessionRunning: boolean
  ) => void;
};

export const InteractiveRunsContext = React.createContext<
  InteractiveRunsContextType
>({} as InteractiveRunsContextType);

export const useInteractiveRunsContext = () =>
  React.useContext(InteractiveRunsContext);

export const InteractiveRunsContextProvider: React.FC = ({ children }) => {
  const { setConfirm, setAlert } = useAppContext();
  const {
    stepExecutionState,
    pipelineRunning,
    isCancellingRun,
    setIsCancellingRun,
    executeRun,
  } = useInteractiveRuns();

  const cancelRun = React.useCallback(
    async ({ jobUuid, runUuid }: { jobUuid?: string; runUuid?: string }) => {
      if (jobUuid && runUuid) {
        setConfirm(
          "Warning",
          "Are you sure that you want to cancel this job run?",
          async (resolve) => {
            setIsCancellingRun(true);
            try {
              await fetcher(`/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`, {
                method: "DELETE",
              });
              resolve(true);
            } catch (error) {
              setAlert("Error", `Failed to cancel this job run.`);
              resolve(false);
            }
            setIsCancellingRun(false);
            return true;
          }
        );
        return;
      }

      if (!pipelineRunning) {
        setAlert("Error", "There is no pipeline running.");
        return;
      }

      try {
        setIsCancellingRun(true);
        await fetcher(`${PIPELINE_RUN_STATUS_ENDPOINT}/${runUuid}`, {
          method: "DELETE",
        });
        setIsCancellingRun(false);
      } catch (error) {
        setAlert(
          "Error",
          `Could not cancel pipeline run for runUuid ${runUuid}`
        );
      }
    },
    [pipelineRunning, setAlert, setConfirm, setIsCancellingRun]
  );

  const runSteps = React.useCallback(
    (uuids: string[], type: RunStepsType, isSessionRunning: boolean) => {
      if (!isSessionRunning) {
        setAlert(
          "Error",
          "There is no active session. Please start the session first."
        );
        return;
      }

      executeRun(uuids, type);
    },
    [executeRun, setAlert]
  );

  return (
    <InteractiveRunsContext.Provider
      value={{
        stepExecutionState,
        pipelineRunning,
        isCancellingRun,
        setIsCancellingRun,
        executeRun,
        cancelRun,
        runSteps,
      }}
    >
      {children}
    </InteractiveRunsContext.Provider>
  );
};
