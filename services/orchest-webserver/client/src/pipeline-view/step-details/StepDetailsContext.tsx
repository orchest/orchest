import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { StepsDict, StepState } from "@/types";
import { ALLOWED_STEP_EXTENSIONS } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

/** Represents all the connection a single step has. */
export type StepConnection = {
  targetUuid: string;
  title: string;
  filePath: string;
  direction: "incoming" | "outgoing";
};

export type StepDetailsContextType = {
  doesStepFileExist: boolean;
  isCheckingFileValidity: boolean;
  step: StepState;
  connections: StepConnection[];
  disconnect(startStepUUID: string, endStepUUID: string): void;
};

export const StepDetailsContext = React.createContext<StepDetailsContextType>(
  {} as StepDetailsContextType
);

export const useStepDetailsContext = () => React.useContext(StepDetailsContext);

const toStepConnection = (
  direction: "incoming" | "outgoing",
  steps: StepsDict
) => (targetUuid: string): StepConnection => ({
  targetUuid,
  direction,
  title: steps[targetUuid].title,
  filePath: steps[targetUuid].file_path,
});

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
    if (!step) return [];

    const { incoming_connections, outgoing_connections } = step;

    return incoming_connections
      .map(toStepConnection("incoming", steps))
      .concat(outgoing_connections.map(toStepConnection("outgoing", steps)));
  }, [steps, step]);

  return (
    <StepDetailsContext.Provider
      value={{
        disconnect,
        doesStepFileExist,
        isCheckingFileValidity,
        connections,
        step,
      }}
    >
      {children}
    </StepDetailsContext.Provider>
  );
};
