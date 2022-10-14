import { useHasChanged } from "@/hooks/useHasChanged";
import {
  DEFAULT_SCALE_FACTOR,
  SCALE_INCREMENTS,
  useCanvasScaling,
} from "@/pipeline-view/contexts/CanvasScalingContext";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { usePipelineRefs } from "@/pipeline-view/contexts/PipelineRefsContext";
import {
  INITIAL_PIPELINE_OFFSET,
  usePipelineCanvasState,
} from "@/pipeline-view/hooks/usePipelineCanvasState";
import { getOffset } from "@/utils/element";
import {
  addPoints,
  isSamePoint,
  multiplyPoint,
  Point2D,
} from "@/utils/geometry";
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

const READ_ONLY_STARTING_OFFSET: Readonly<Point2D> = [0, 75];
const NO_STARTING_OFFSET: Readonly<Point2D> = [0, 0];

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
  const { isReadOnly, pipelineUuid } = usePipelineDataContext();
  const changedPipeline = useHasChanged(
    pipelineUuid,
    (prev, curr) => prev !== curr && curr !== undefined
  );

  // We offset the starting point a bit when the read-only banner is visible.
  const startingOffsetRef = React.useRef<Readonly<Point2D>>(NO_STARTING_OFFSET);
  startingOffsetRef.current = isReadOnly
    ? READ_ONLY_STARTING_OFFSET
    : NO_STARTING_OFFSET;

  const resetPipelineCanvas = React.useCallback(() => {
    setPipelineCanvasState({
      pipelineOffset: addPoints(
        INITIAL_PIPELINE_OFFSET,
        startingOffsetRef.current
      ),
      pipelineCanvasOffset: [0, 0],
      pipelineOrigin: [0, 0],
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
    const viewportOffset = getOffset(pipelineViewportRef.current ?? undefined);
    const canvasOffset = getOffset(pipelineCanvasRef.current ?? undefined);

    if (pipelineViewportRef.current === null) {
      return;
    }

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

  // Reset the pipeline canvas position when the pipeline changes.
  React.useEffect(resetPipelineCanvas, [changedPipeline, resetPipelineCanvas]);

  // Apply the offset if readonly is set to true and the canvas hasn't moved
  React.useLayoutEffect(() => {
    if (!isReadOnly) return;

    setPipelineCanvasState((current) => {
      const isAtWrongStart = isSamePoint(
        INITIAL_PIPELINE_OFFSET,
        current.pipelineOffset
      );

      return isAtWrongStart
        ? {
            pipelineOffset: addPoints(
              INITIAL_PIPELINE_OFFSET,
              startingOffsetRef.current
            ),
          }
        : current;
    });
  }, [isReadOnly, setPipelineCanvasState]);

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
