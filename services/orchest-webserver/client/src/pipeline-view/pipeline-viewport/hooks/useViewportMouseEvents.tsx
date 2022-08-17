import { useTrackMouse } from "@/hooks/useTrackMouse";
import { useCanvasScaling } from "@/pipeline-view/contexts/CanvasScalingContext";
import { usePipelineCanvasContext } from "@/pipeline-view/contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { usePipelineRefs } from "@/pipeline-view/contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import { getOffset } from "@/utils/element";
import { addPoints, dividePoint, subtractPoints } from "@/utils/geometry";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**A hook that handles all mouse events that within the pipeline viewport. */
export const useViewportMouseEvents = () => {
  const { disabled } = usePipelineDataContext();
  const { scaleFactor } = useCanvasScaling();
  const { keysDown, pipelineCanvasRef, newConnection } = usePipelineRefs();
  const { getMousePoint, getMouseDelta } = useTrackMouse();

  const {
    uiStateDispatch,
    uiState: { stepSelector },
  } = usePipelineUiStateContext();

  const {
    pipelineCanvasState: { panningState },
    setPipelineCanvasState,
  } = usePipelineCanvasContext();

  const hasMouseMoved = React.useRef(false);
  const onMouseMoveDocument = React.useCallback(() => {
    if (!hasMouseMoved.current || !pipelineCanvasRef.current) {
      // ensure that mouseTracker is in sync, to prevent jumping in some cases.
      hasMouseMoved.current = true;
      return;
    }

    const canvasOffset = getOffset(pipelineCanvasRef.current);

    // update newConnection's position
    if (newConnection.current) {
      const end = dividePoint(
        subtractPoints(getMousePoint(), canvasOffset),
        scaleFactor
      );

      newConnection.current = { ...newConnection.current, end };
    }

    if (stepSelector.active) {
      uiStateDispatch({ type: "UPDATE_STEP_SELECTOR", payload: canvasOffset });
    }

    if (panningState === "panning") {
      setPipelineCanvasState((current) => ({
        pipelineOffset: addPoints(current.pipelineOffset, getMouseDelta()),
      }));
    }
  }, [
    pipelineCanvasRef,
    newConnection,
    stepSelector.active,
    panningState,
    getMousePoint,
    scaleFactor,
    uiStateDispatch,
    setPipelineCanvasState,
    getMouseDelta,
  ]);

  const onMouseLeaveViewport = React.useCallback(() => {
    if (stepSelector.active) {
      uiStateDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
    }
    if (newConnection.current) {
      uiStateDispatch({
        type: "REMOVE_CONNECTION",
        payload: newConnection.current,
      });
    }
  }, [uiStateDispatch, stepSelector.active, newConnection]);

  const onMouseDownDocument = React.useCallback(
    (event: MouseEvent) => {
      if (event.button === 0 && panningState === "ready-to-pan") {
        setPipelineCanvasState({ panningState: "panning" });
      }
    },
    [panningState, setPipelineCanvasState]
  );

  const onMouseUpDocument = React.useCallback(
    (event: MouseEvent) => {
      const shouldPan =
        event.button === 0 &&
        keysDown.has("Space") &&
        panningState === "panning";

      if (shouldPan) {
        setPipelineCanvasState({ panningState: "ready-to-pan" });
      }
    },
    [panningState, setPipelineCanvasState, keysDown]
  );

  React.useEffect(() => {
    if (disabled) return;
    const hasPointerEvents = hasValue(window.PointerEvent);

    const downEventType = hasPointerEvents ? "pointerdown" : "mousedown";
    const upEventType = hasPointerEvents ? "pointerup" : "mouseup";
    const moveEventType = hasPointerEvents ? "pointermove" : "mousemove";
    const leaveEventType = hasPointerEvents ? "pointerleave" : "mouseleave";

    document.body.addEventListener(downEventType, onMouseDownDocument);
    document.body.addEventListener(upEventType, onMouseUpDocument);
    document.body.addEventListener(moveEventType, onMouseMoveDocument);
    document.body.addEventListener(leaveEventType, onMouseLeaveViewport);

    return () => {
      document.body.removeEventListener(downEventType, onMouseDownDocument);
      document.body.removeEventListener(upEventType, onMouseUpDocument);
      document.body.removeEventListener(moveEventType, onMouseMoveDocument);
      document.body.removeEventListener(leaveEventType, onMouseLeaveViewport);
    };
  }, [
    disabled,
    onMouseLeaveViewport,
    onMouseMoveDocument,
    onMouseDownDocument,
    onMouseUpDocument,
  ]);
};
