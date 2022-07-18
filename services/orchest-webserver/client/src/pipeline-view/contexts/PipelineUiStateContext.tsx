import { StepsDict } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { extractStepsFromPipelineJson } from "../common";
import {
  PipelineUiState,
  PipelineUiStateAction,
  usePipelineUiState,
} from "../hooks/usePipelineUiState";
import { usePipelineDataContext } from "./PipelineDataContext";
import { usePipelineRefs } from "./PipelineRefsContext";

export type PipelineUiStateContextType = {
  uiState: PipelineUiState;
  uiStateDispatch: React.Dispatch<PipelineUiStateAction>;
  instantiateConnection: (
    startNodeUUID: string,
    endNodeUUID?: string | undefined
  ) => {
    startNodeUUID: string;
    endNodeUUID: string | undefined;
  };
};

export const PipelineUiStateContext = React.createContext<
  PipelineUiStateContextType
>({} as PipelineUiStateContextType);

export const usePipelineUiStateContext = () =>
  React.useContext(PipelineUiStateContext);

export const PipelineUiStateContextProvider: React.FC = ({ children }) => {
  const { zIndexMax } = usePipelineRefs();
  const { uiState, uiStateDispatch } = usePipelineUiState();
  const { pipelineJson } = usePipelineDataContext();

  const instantiateConnection = React.useCallback(
    (startNodeUUID: string, endNodeUUID?: string | undefined) => {
      const connection = { startNodeUUID, endNodeUUID };

      uiStateDispatch({
        type: "INSTANTIATE_CONNECTION",
        payload: connection,
      });

      return connection;
    },
    [uiStateDispatch]
  );

  // this is only called once when pipelineJson is loaded in the beginning
  const initializeUiState = React.useCallback(
    (initialSteps: StepsDict) => {
      uiStateDispatch({ type: "SET_STEPS", payload: initialSteps });
      zIndexMax.current = Object.keys(initialSteps).length;
      Object.values(initialSteps).forEach((step) => {
        step.incoming_connections.forEach((startNodeUUID) => {
          let endNodeUUID = step.uuid;

          instantiateConnection(startNodeUUID, endNodeUUID);

          zIndexMax.current += 1;
        });
      });
    },
    [uiStateDispatch, instantiateConnection, zIndexMax]
  );

  // const initialized = React.useRef(false);
  React.useEffect(() => {
    // if (hasValue(pipelineJson) && !initialized.current) {
    if (hasValue(pipelineJson)) {
      // initialized.current = true;
      const newSteps = extractStepsFromPipelineJson(pipelineJson);
      initializeUiState(newSteps);
    }
  }, [initializeUiState, pipelineJson]);

  return (
    <PipelineUiStateContext.Provider
      value={{ uiState, uiStateDispatch, instantiateConnection }}
    >
      {children}
    </PipelineUiStateContext.Provider>
  );
};
