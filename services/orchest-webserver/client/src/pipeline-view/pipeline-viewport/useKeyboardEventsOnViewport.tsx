import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import {
  DEFAULT_SCALE_FACTOR,
  originTransformScaling,
  scaleCorrected,
} from "../common";
import { usePipelineUiParamsContext } from "../contexts/PipelineUiParamsContext";
import { PipelineCanvasState } from "../hooks/usePipelineCanvasState";
import { CanvasFunctions } from "./PipelineViewport";
import { useGestureOnViewport } from "./useGestureOnViewport";

export const useKeyboardEventsOnViewport = (
  setPipelineCanvasState: React.Dispatch<
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
  >,
  resetPipelineCanvas: () => void
) => {
  const canvasFuncRef = React.useRef<CanvasFunctions>();
  const {
    pipelineCanvasRef,
    pipelineViewportRef,
    uiParams: { scaleFactor },
    uiParamsDispatch,
    keysDown,
  } = usePipelineUiParamsContext();

  React.useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (activeElementIsInput()) return;

      if (event.key === " " && !keysDown.has("Space")) {
        // if any element is on focus, pressing space bar is equivalent to mouse click
        // therefore it's needed to remove all "focus" state
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setPipelineCanvasState({ panningState: "ready-to-pan" });
        keysDown.add("Space");
      }
      if (canvasFuncRef.current && event.key === "h" && !keysDown.has("h")) {
        canvasFuncRef.current.centerView();
        keysDown.add("h");
      }
    };
    const keyUpHandler = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setPipelineCanvasState({ panningState: "idle" });
        keysDown.delete("Space");
      }
      if (event.key === "h") {
        keysDown.delete("h");
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);
    document.body.addEventListener("keyup", keyUpHandler);
    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
      document.body.removeEventListener("keyup", keyUpHandler);
    };
  }, [keysDown, canvasFuncRef, setPipelineCanvasState]);

  const getCurrentOrigin = React.useCallback(() => {
    const canvasOffset = getOffset(pipelineCanvasRef.current);
    const viewportOffset = getOffset(pipelineViewportRef.current ?? undefined);

    const x = canvasOffset.left - viewportOffset.left;
    const y = canvasOffset.top - viewportOffset.top;

    return { x, y };
  }, [pipelineCanvasRef, pipelineViewportRef]);

  const setPipelineHolderOrigin = React.useCallback(
    (newOrigin: [number, number]) => {
      const [x, y] = newOrigin;
      const currentOrigin = getCurrentOrigin();
      let [translateX, translateY] = originTransformScaling(
        [x, y],
        scaleFactor
      );

      setPipelineCanvasState((current) => ({
        pipelineOrigin: [x, y],
        pipelineStepsHolderOffsetLeft:
          translateX + currentOrigin.x - current.pipelineOffset[0],
        pipelineStepsHolderOffsetTop:
          translateY + currentOrigin.y - current.pipelineOffset[1],
      }));
    },
    [scaleFactor, setPipelineCanvasState, getCurrentOrigin]
  );

  const centerView = React.useCallback(() => {
    resetPipelineCanvas();
    uiParamsDispatch({
      type: "SET_SCALE_FACTOR",
      payload: DEFAULT_SCALE_FACTOR,
    });
  }, [uiParamsDispatch, resetPipelineCanvas]);

  const centerPipelineOrigin = React.useCallback(() => {
    let viewportOffset = getOffset(pipelineViewportRef.current ?? undefined);
    const canvasOffset = getOffset(pipelineCanvasRef.current ?? undefined);

    if (pipelineViewportRef.current === null) {
      return;
    }
    let viewportWidth = getWidth(pipelineViewportRef.current);
    let viewportHeight = getHeight(pipelineViewportRef.current);

    let originalX = viewportOffset.left - canvasOffset.left + viewportWidth / 2;
    let originalY = viewportOffset.top - canvasOffset.top + viewportHeight / 2;

    let centerOrigin = [
      scaleCorrected(originalX, scaleFactor),
      scaleCorrected(originalY, scaleFactor),
    ] as [number, number];

    setPipelineHolderOrigin(centerOrigin);
  }, [
    pipelineCanvasRef,
    pipelineViewportRef,
    scaleFactor,
    setPipelineHolderOrigin,
  ]);

  // NOTE: React.useImperativeHandle should only be used in special cases
  // here we have to use it to allow parent component (i.e. PipelineEditor) to center pipeline canvas
  // otherwise, we have to use renderProps, but then we will have more issues
  // e.g. we cannot keep the action buttons above PipelineCanvas
  React.useImperativeHandle(
    canvasFuncRef,
    () => ({ centerPipelineOrigin, centerView }),
    [centerPipelineOrigin, centerView]
  );

  const zoom = useGestureOnViewport(
    pipelineViewportRef,
    setPipelineHolderOrigin
  );

  return { setPipelineHolderOrigin, centerPipelineOrigin, centerView, zoom };
};
