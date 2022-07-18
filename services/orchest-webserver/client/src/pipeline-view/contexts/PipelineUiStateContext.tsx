import { useForceUpdate } from "@/hooks/useForceUpdate";
import { StepsDict } from "@/types";
import { layoutPipeline } from "@/utils/pipeline-layout";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { extractStepsFromPipelineJson, updatePipelineJson } from "../common";
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
  recalibrate: () => void;
  autoLayoutPipeline: () => void;
};

export const PipelineUiStateContext = React.createContext<
  PipelineUiStateContextType
>({} as PipelineUiStateContextType);

export const usePipelineUiStateContext = () =>
  React.useContext(PipelineUiStateContext);

export const PipelineUiStateContextProvider: React.FC = ({ children }) => {
  const { zIndexMax, stepRefs } = usePipelineRefs();
  const { uiState, uiStateDispatch } = usePipelineUiState();
  const { steps, connections } = uiState;
  const {
    pipelineJson,
    isReadOnly,
    setPipelineJson,
  } = usePipelineDataContext();

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

  // in read-only mode, PipelineEditor doesn't re-render after stepDomRefs collects all DOM elements of the steps
  // we need to force re-render one more time to show the connection lines
  const shouldForceRerender =
    isReadOnly &&
    connections.length > 0 &&
    Object.keys(stepRefs.current).length === 0;

  const [, forceUpdate] = useForceUpdate();

  React.useLayoutEffect(() => {
    if (shouldForceRerender) forceUpdate();
  }, [shouldForceRerender, forceUpdate]);

  const recalibrate = React.useCallback(() => {
    // ensure that connections are re-rendered against the final positions of the steps
    setPipelineJson((value) => value, true);
  }, [setPipelineJson]);

  const autoLayoutPipeline = React.useCallback(() => {
    const spacingFactor = 0.7;
    const gridMargin = 20;

    setPipelineJson((current) => {
      if (!current) return current;
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

      const updated = updatePipelineJson(current, updatedSteps);

      uiStateDispatch({ type: "SAVE_STEPS", payload: updated.steps });
      return updated;
    }, true); // flush page, re-instantiate all UI elements with new local state for dragging
    // the rendering of connection lines depend on the positions of the steps
    // so we need another render to redraw the connections lines
    // here we intentionally break the React built-in event batching
    window.setTimeout(() => {
      recalibrate();
    }, 0);
  }, [recalibrate, setPipelineJson, steps, uiStateDispatch]);

  return (
    <PipelineUiStateContext.Provider
      value={{
        uiState,
        uiStateDispatch,
        instantiateConnection,
        recalibrate,
        autoLayoutPipeline,
      }}
    >
      {children}
    </PipelineUiStateContext.Provider>
  );
};
