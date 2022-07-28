import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { StepsDict, StepState } from "@/types";
import { ALLOWED_STEP_EXTENSIONS } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

type ConnectionByUuid = Record<string, { title: string; file_path: string }>;

export type StepDetailsContextType = {
  doesStepFileExist: boolean;
  isCheckingFileValidity: boolean;
  step: StepState;
  steps: StepsDict;
  connections: ConnectionByUuid;
  disconnect(startStepUUID: string, endStepUUID: string): void;
};

export const StepDetailsContext = React.createContext<StepDetailsContextType>(
  {} as StepDetailsContextType
);

export const useStepDetailsContext = () => React.useContext(StepDetailsContext);

export const StepDetailsContextProvider: React.FC = ({ children }) => {
  const {
    projectUuid,
    pipelineUuid,
    runUuid,
    jobUuid,
  } = usePipelineDataContext();
  const { uiStateDispatch, uiState } = usePipelineUiStateContext();
  const { steps, openedStep } = uiState;

  const disconnect = React.useCallback(
    (startNodeUUID: string, endNodeUUID: string) => {
      uiStateDispatch({
        type: "REMOVE_CONNECTION",
        payload: { startNodeUUID, endNodeUUID },
      });
    },
    [uiStateDispatch]
  );

  const step = steps[openedStep || ""];
  const [doesStepFileExist, isCheckingFileValidity] = useCheckFileValidity({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: step?.file_path,
    allowedExtensions: ALLOWED_STEP_EXTENSIONS,
  });

  const connections = React.useMemo(() => {
    if (!step) return {};

    const { incoming_connections = [], outgoing_connections = [] } = step;

    return incoming_connections
      .concat(outgoing_connections)
      .reduce((all, id) => {
        const { title, file_path } = steps[id];

        return { ...all, [id]: { title, file_path } };
      }, {} as ConnectionByUuid);
  }, [steps, step]);

  return (
    <StepDetailsContext.Provider
      value={{
        disconnect,
        doesStepFileExist,
        isCheckingFileValidity,
        connections,
        step,
        steps,
      }}
    >
      {children}
    </StepDetailsContext.Provider>
  );
};
