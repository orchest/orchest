import { useHasChanged } from "@/hooks/useHasChanged";
import React from "react";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

/**
 * Render Connections after stepRefs is loaded.
 *
 * Connections can only be instantiated with the position of the ConnectionDot's,
 * which are registered by stepRefs. This means that we can only start to draw connections,
 * after the DOM element of steps are rendered.
 */
export const useInitializeConnections = () => {
  const { stepRefs } = usePipelineRefs();
  const {
    uiState: { steps },
    recalibrate,
  } = usePipelineUiStateContext();
  const stepCount = Object.keys(steps).length;

  const isStepRefsLoaded = useHasChanged(
    stepCount === Object.keys(stepRefs.current).length
  );

  React.useLayoutEffect(() => {
    if (isStepRefsLoaded && stepCount > 0) {
      recalibrate();
    }
  }, [isStepRefsLoaded, recalibrate, stepCount]);
};
