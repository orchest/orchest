import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import {
  DEFAULT_SCALE_FACTOR,
  originTransformScaling,
  scaleCorrected,
} from "../common";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { useScaleFactor } from "../contexts/ScaleFactorContext";
import {
  INITIAL_PIPELINE_POSITION,
  usePipelineCanvasState,
} from "../hooks/usePipelineCanvasState";
import { useGestureOnViewport } from "./useGestureOnViewport";

export const useKeyboardEventsOnViewport = () => {
  const {
    pipelineViewportRef,
    pipelineCanvasRef,
    keysDown,
  } = usePipelineRefs();
  const { scaleFactor, setScaleFactor } = useScaleFactor();
  const [
    pipelineCanvasState,
    setPipelineCanvasState,
  ] = usePipelineCanvasState();

  const resetPipelineCanvas = React.useCallback(() => {
    setPipelineCanvasState({
      pipelineOffset: INITIAL_PIPELINE_POSITION,
      pipelineStepsHolderOffsetLeft: 0,
      pipelineStepsHolderOffsetTop: 0,
    });
  }, [setPipelineCanvasState]);

  const centerView = React.useCallback(() => {
    resetPipelineCanvas();
    setScaleFactor(DEFAULT_SCALE_FACTOR);
  }, [setScaleFactor, resetPipelineCanvas]);

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

  const centerPipelineOrigin = React.useCallback(() => {
    const viewportOffset = getOffset(pipelineViewportRef.current ?? undefined);
    const canvasOffset = getOffset(pipelineCanvasRef.current ?? undefined);

    if (pipelineViewportRef.current === null) {
      return;
    }
    const viewportWidth = getWidth(pipelineViewportRef.current);
    const viewportHeight = getHeight(pipelineViewportRef.current);

    const originalX =
      viewportOffset.left - canvasOffset.left + viewportWidth / 2;
    const originalY =
      viewportOffset.top - canvasOffset.top + viewportHeight / 2;

    const centerOrigin = [
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

  const zoom = useGestureOnViewport(
    pipelineCanvasState,
    setPipelineCanvasState,
    pipelineViewportRef,
    setPipelineHolderOrigin
  );

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
    };
    const keyUpHandler = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setPipelineCanvasState({ panningState: "idle" });
        keysDown.delete("Space");
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);
    document.body.addEventListener("keyup", keyUpHandler);
    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
      document.body.removeEventListener("keyup", keyUpHandler);
    };
  }, [keysDown, centerView, setPipelineCanvasState]);

  return {
    pipelineCanvasState,
    setPipelineCanvasState,
    resetPipelineCanvas,
    centerView,
    centerPipelineOrigin,
    setPipelineHolderOrigin,
    zoom,
  };
};
