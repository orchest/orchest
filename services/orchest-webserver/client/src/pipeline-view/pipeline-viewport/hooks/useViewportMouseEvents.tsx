import { getScaleCorrectedPosition } from "@/pipeline-view/common";
import { usePipelineCanvasContext } from "@/pipeline-view/contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { usePipelineRefs } from "@/pipeline-view/contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import { useScaleFactor } from "@/pipeline-view/contexts/ScaleFactorContext";
import { getOffset } from "@/utils/jquery-replacement";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**A hook that handles all mouse events that within the pipeline viewport. */
export const useViewportMouseEvents = () => {
  const { disabled } = usePipelineDataContext();
  const { scaleFactor, trackMouseMovement } = useScaleFactor();
  const {
    keysDown,
    mouseTracker,
    pipelineCanvasRef,
    newConnection,
  } = usePipelineRefs();

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
    if (!hasMouseMoved.current) {
      // ensure that mouseTracker is in sync, to prevent jumping in some cases.
      hasMouseMoved.current = true;
      return;
    }
    let canvasOffset = getOffset(pipelineCanvasRef.current);
    // update newConnection's position
    if (newConnection.current) {
      const { x, y } = getScaleCorrectedPosition({
        offset: canvasOffset,
        position: mouseTracker.current.client,
        scaleFactor,
      });

      newConnection.current = { ...newConnection.current, xEnd: x, yEnd: y };
    }

    if (stepSelector.active) {
      uiStateDispatch({ type: "UPDATE_STEP_SELECTOR", payload: canvasOffset });
    }

    if (panningState === "panning") {
      const dx = mouseTracker.current.unscaledDelta.x;
      const dy = mouseTracker.current.unscaledDelta.y;

      setPipelineCanvasState((current) => ({
        pipelineOffset: [
          current.pipelineOffset[0] + dx,
          current.pipelineOffset[1] + dy,
        ],
      }));
    }
  }, [
    uiStateDispatch,
    pipelineCanvasRef,
    scaleFactor,
    stepSelector.active,
    mouseTracker,
    newConnection,
    panningState,
    setPipelineCanvasState,
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
    (e: MouseEvent) => {
      if (e.button === 0 && panningState === "ready-to-pan") {
        trackMouseMovement(e.clientX, e.clientY);
        setPipelineCanvasState({ panningState: "panning" });
      }
    },
    [panningState, setPipelineCanvasState, trackMouseMovement]
  );

  const onMouseUpDocument = React.useCallback(
    (e: MouseEvent) => {
      if (
        e.button === 0 &&
        keysDown.has("Space") &&
        panningState === "panning"
      ) {
        setPipelineCanvasState({ panningState: "ready-to-pan" });
      }
    },
    [panningState, setPipelineCanvasState, keysDown]
  );

  React.useEffect(() => {
    if (disabled) return;
    const supportPointerEvent = hasValue(window.PointerEvent);

    const downEventType = supportPointerEvent ? "pointerdown" : "mousedown";
    const upEventType = supportPointerEvent ? "pointerup" : "mouseup";
    const moveEventType = supportPointerEvent ? "pointermove" : "mousemove";
    const leaveEventType = supportPointerEvent ? "pointerleave" : "mouseleave";

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
