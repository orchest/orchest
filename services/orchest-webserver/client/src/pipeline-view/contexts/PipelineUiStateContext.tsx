import { useForceUpdate } from "@/hooks/useForceUpdate";
import { layoutPipeline } from "@/utils/pipeline-layout";
import { setOutgoingConnections } from "@/utils/webserver-utils";
import React from "react";
import { updatePipelineJson } from "../common";
import { useInitializePipelineEditor } from "../hooks/useInitializePipelineEditor";
import {
  PipelineUiState,
  PipelineUiStateAction,
  usePipelineUiState,
} from "../hooks/usePipelineUiState";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
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
  autoLayoutPipeline: () => void;
};

export const PipelineUiStateContext = React.createContext<
  PipelineUiStateContextType
>({} as PipelineUiStateContextType);

export const usePipelineUiStateContext = () =>
  React.useContext(PipelineUiStateContext);

export const PipelineUiStateContextProvider: React.FC = ({ children }) => {
  const { stepRefs } = usePipelineRefs();
  const { uiState, uiStateDispatch } = usePipelineUiState();
  const { steps, connections } = uiState;
  const { isReadOnly, pipelineJson } = usePipelineDataContext();

  useInitializePipelineEditor(uiStateDispatch);

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

  // in read-only mode, PipelineEditor doesn't re-render after stepRefs collects all DOM elements of the steps
  // we need to force re-render one more time to show the connection lines
  const shouldForceRerender =
    isReadOnly &&
    connections.length > 0 &&
    Object.keys(stepRefs.current).length === 0;

  const [, forceUpdate] = useForceUpdate();

  React.useLayoutEffect(() => {
    if (shouldForceRerender) forceUpdate();
  }, [shouldForceRerender, forceUpdate]);

  const autoLayoutPipeline = React.useCallback(() => {
    if (!pipelineJson) return;

    const spacingFactor = 0.7;
    const gridMargin = 20;
    const updatedSteps = layoutPipeline(
      // Use the pipeline definition from the editor
      steps,
      STEP_HEIGHT,
      (1 + spacingFactor * (STEP_HEIGHT / STEP_WIDTH)) *
        (STEP_WIDTH / STEP_HEIGHT),
      1 + spacingFactor,
      gridMargin,
      gridMargin * 4, // don't put steps behind top buttons
      gridMargin,
      STEP_HEIGHT
    );

    const updated = updatePipelineJson(pipelineJson, updatedSteps);

    uiStateDispatch({
      type: "SAVE_STEPS",
      payload: setOutgoingConnections(updated.steps),
    });
  }, [pipelineJson, steps, uiStateDispatch]);

  return (
    <PipelineUiStateContext.Provider
      value={{
        uiState,
        uiStateDispatch,
        instantiateConnection,
        autoLayoutPipeline,
      }}
    >
      {children}
    </PipelineUiStateContext.Provider>
  );
};
