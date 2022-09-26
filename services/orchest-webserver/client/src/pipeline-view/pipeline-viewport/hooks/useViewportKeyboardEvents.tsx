import {
  DEFAULT_SCALE_FACTOR,
  SCALE_INCREMENTS,
  useCanvasScaling,
} from "@/pipeline-view/contexts/CanvasScalingContext";
import { usePipelineRefs } from "@/pipeline-view/contexts/PipelineRefsContext";
import {
  INITIAL_PIPELINE_OFFSET,
  usePipelineCanvasState,
} from "@/pipeline-view/hooks/usePipelineCanvasState";
import { getOffset } from "@/utils/element";
import { multiplyPoint, Point2D } from "@/utils/geometry";
import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import { useViewportGestures } from "./useViewportGestures";

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

export const useViewportKeyboardEvents = () => {
  const {
    pipelineViewportRef,
    pipelineCanvasRef,
    keysDown,
  } = usePipelineRefs();
  const { scaleFactor, setScaleFactor } = useCanvasScaling();
  const [
    pipelineCanvasState,
    setPipelineCanvasState,
  ] = usePipelineCanvasState();

  const resetPipelineCanvas = React.useCallback(() => {
    setPipelineCanvasState({
      pipelineOffset: INITIAL_PIPELINE_OFFSET,
      pipelineCanvasOffset: [0, 0],
    });
  }, [setPipelineCanvasState]);

  const centerView = React.useCallback(() => {
    resetPipelineCanvas();
    setScaleFactor(DEFAULT_SCALE_FACTOR);
  }, [setScaleFactor, resetPipelineCanvas]);

  const setPipelineCanvasOrigin = React.useCallback(
    (newOrigin: Point2D) => {
      const canvasOffset = getOffset(pipelineCanvasRef.current);
      const viewportOffset = getOffset(pipelineViewportRef.current);

      const [translateX, translateY] = invertScaling(newOrigin, scaleFactor);

      const x = canvasOffset[0] - viewportOffset[0];
      const y = canvasOffset[1] - viewportOffset[1];

      setPipelineCanvasState((current) => ({
        pipelineOrigin: newOrigin,
        pipelineCanvasOffset: [
          x + translateX - current.pipelineOffset[0],
          y + translateY - current.pipelineOffset[1],
        ],
      }));
    },
    [
      pipelineCanvasRef,
      pipelineViewportRef,
      scaleFactor,
      setPipelineCanvasState,
    ]
  );

  const centerPipelineOrigin = React.useCallback(() => {
    if (!pipelineViewportRef.current) return;

    const viewportOffset = getOffset(pipelineViewportRef.current);
    const canvasOffset = getOffset(pipelineCanvasRef.current);

    const viewportWidth = pipelineViewportRef.current.clientWidth;
    const viewportHeight = pipelineViewportRef.current.clientHeight;

    const originalX = viewportOffset[0] - canvasOffset[0] + viewportWidth / 2;
    const originalY = viewportOffset[1] - canvasOffset[1] + viewportHeight / 2;

    const centerOrigin: Point2D = [
      originalX / scaleFactor,
      originalY / scaleFactor,
    ];

    setPipelineCanvasOrigin(centerOrigin);
  }, [
    pipelineCanvasRef,
    pipelineViewportRef,
    scaleFactor,
    setPipelineCanvasOrigin,
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

  const zoomBy = useViewportGestures(
    setPipelineCanvasState,
    pipelineViewportRef,
    setPipelineCanvasOrigin
  );

  React.useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (activeElementIsInput()) return;

      if (event.code === "Space" && !keysDown.has("Space")) {
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
      if (event.code === "Space") {
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
    setPipelineCanvasOrigin,
    zoomIn,
    zoomOut,
    zoomBy,
    resetZoom,
  };
};

export const invertScaling = (
  origin: Readonly<Point2D>,
  scaleFactor: number
): Point2D => {
  /* By multiplying the transform-origin with the scaleFactor we get the right
   * displacement for the transformed/scaled parent (pipelineStepHolder)
   * that avoids visual displacement when the origin of the
   * transformed/scaled parent is modified.
   *
   * the adjustedScaleFactor was derived by analyzing the geometric behavior
   * of applying the css transform: translate(...) scale(...);.
   */
  return multiplyPoint(origin, scaleFactor - 1);
};
