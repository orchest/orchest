import { useHasChanged } from "@/hooks/useHasChanged";
import { StepsDict } from "@/types";
import { setOutgoingConnections } from "@/utils/webserver-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { PipelineUiStateAction } from "./usePipelineUiState";

export const useInitializePipelineEditor = (
  uiStateDispatch: React.Dispatch<PipelineUiStateAction>
) => {
  const { pipelineJson } = usePipelineDataContext();

  const initializeUiState = React.useCallback(
    (initialSteps: StepsDict) => {
      uiStateDispatch({ type: "SET_STEPS", payload: initialSteps });
    },
    [uiStateDispatch]
  );

  const hasFetchedPipelineJsonOnMount = useHasChanged(
    pipelineJson,
    (prev, curr) => !prev && Boolean(curr)
  );

  React.useEffect(() => {
    if (pipelineJson) {
      const state = setOutgoingConnections(pipelineJson.steps);

      initializeUiState(state);
    }
  }, [initializeUiState, hasFetchedPipelineJsonOnMount]); // eslint-disable-line react-hooks/exhaustive-deps
};
