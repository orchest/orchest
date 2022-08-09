import { originTransformScaling, scaleCorrected } from "@/pipeline-view/common";
import { usePipelineRefs } from "@/pipeline-view/contexts/PipelineRefsContext";
import {
  DEFAULT_SCALE_FACTOR,
  SCALE_INCREMENTS,
  useScaleFactor,
} from "@/pipeline-view/contexts/ScaleFactorContext";
import {
  INITIAL_PIPELINE_POSITION,
  usePipelineCanvasState,
} from "@/pipeline-view/hooks/usePipelineCanvasState";
import { Point2D } from "@/types";
import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import { useGestureOnViewport } from "./useGestureOnViewport";

const nearestIncrementIndex = (value: number) => {
  let bestDelta = Infinity;
  let bestIndex = Math.floor(SCALE_INCREMENTS.length / 2);

  for (let i = 0; i < SCALE_INCREMENTS.length; i++) {
    const delta = Math.abs(value - SCALE_INCREMENTS[i]);

    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    } else {
      return bestIndex;
    }
  }

  return bestIndex;
};

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
    (newOrigin: Point2D) => {
      const currentOrigin = getCurrentOrigin();
      const [translateX, translateY] = originTransformScaling(
        newOrigin,
        scaleFactor
      );

      setPipelineCanvasState((current) => ({
        pipelineOrigin: newOrigin,
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

  const zoomIn = React.useCallback(() => {
    centerPipelineOrigin();
    setScaleFactor((currentScale) => {
      const closestIndex = nearestIncrementIndex(currentScale);
      const closestScale = SCALE_INCREMENTS[closestIndex];
      const newIndex =
        currentScale < closestScale ? closestIndex : closestIndex + 1;

      return SCALE_INCREMENTS[Math.min(newIndex, SCALE_INCREMENTS.length - 1)];
    });
  }, [centerPipelineOrigin, setScaleFactor]);

  const zoomOut = React.useCallback(() => {
    centerPipelineOrigin();
    setScaleFactor((currentScale) => {
      const closestIndex = nearestIncrementIndex(currentScale);
      const closestScale = SCALE_INCREMENTS[closestIndex];
      const newIndex =
        currentScale > closestScale ? closestIndex : closestIndex - 1;

      return SCALE_INCREMENTS[Math.max(newIndex, 0)];
    });
  }, [centerPipelineOrigin, setScaleFactor]);

  const resetZoom = React.useCallback(() => {
    setScaleFactor(DEFAULT_SCALE_FACTOR);
  }, [setScaleFactor]);

  const zoomBy = useGestureOnViewport(
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
    zoomIn,
    zoomOut,
    zoomBy,
    resetZoom,
  };
};
