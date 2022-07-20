import { StepsDict } from "@/types";
import React from "react";
import { extractStepsFromPipelineJson } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { PipelineUiStateAction } from "./usePipelineUiState";

export const useInitializePipelineEditor = (
  uiStateDispatch: React.Dispatch<PipelineUiStateAction>
) => {
  const { zIndexMax } = usePipelineRefs();
  const { pipelineJson } = usePipelineDataContext();

  const initializeUiState = React.useCallback(
    (initialSteps: StepsDict) => {
      uiStateDispatch({ type: "SET_STEPS", payload: initialSteps });
      zIndexMax.current = Object.keys(initialSteps).length;

      const connections = Object.values(initialSteps).flatMap((step) => {
        const connections = step.incoming_connections.map((startNodeUUID) => {
          return { startNodeUUID, endNodeUUID: step.uuid };
        });
        zIndexMax.current += connections.length;
        return connections;
      });

      uiStateDispatch({
        type: "INSTANTIATE_CONNECTIONS",
        payload: connections,
      });
    },
    [uiStateDispatch, zIndexMax]
  );

  React.useEffect(() => {
    // `hash` is added from the first re-render.
    if (pipelineJson && !Boolean(pipelineJson.hash)) {
      const initialSteps = extractStepsFromPipelineJson(pipelineJson);
      initializeUiState(initialSteps);
    }
  }, [initializeUiState, pipelineJson]);
};
