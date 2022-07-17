import { Position } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { createUseGesture, pinchAction, wheelAction } from "@use-gesture/react";
import React from "react";
import { scaleCorrected } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { useScaleFactor } from "../contexts/ScaleFactorContext";
import { PipelineCanvasState } from "../hooks/usePipelineCanvasState";

const useGesture = createUseGesture([wheelAction, pinchAction]);

const isTouchpad = (event: WheelEvent) => {
  // deltaMode represents the unit of the delta values scroll amount
  // 0: pixel; 1: line; 2: page
  if (!event.wheelDeltaY && event.deltaMode === 0) return true;
  // see explanation here https://stackoverflow.com/a/62415754
  if (event.wheelDeltaY && event.wheelDeltaY === event.deltaY * -3) return true;

  return false;
};

/**
 * This hook is responsible for pinching and panning on PipelineCanvas
 *
 * It seems that useGesture in one place will intercept all gesture events.
 * So, for example, useWheel in other places in the same view would not work.
 * All the gesture events for PipelineEditor should be implemented in this hook.
 */
export const useGestureOnViewport = (
  pipelineCanvasState: PipelineCanvasState,
  setPipelineCanvasState: React.Dispatch<
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
  >,
  ref: React.MutableRefObject<HTMLDivElement | null>,
  pipelineSetHolderOrigin: (newOrigin: [number, number]) => void
) => {
  const { disabled } = usePipelineDataContext();
  const { scaleFactor, setScaleFactor, trackMouseMovement } = useScaleFactor();
  const { pipelineCanvasRef } = usePipelineRefs();
  const { pipelineOrigin } = pipelineCanvasState;

  const getPositionRelativeToCanvas = React.useCallback(
    ({ x, y }: Position): Position => {
      trackMouseMovement(x, y); // in case that user start zoom-in/out before moving their cursor
      let canvasOffset = getOffset(pipelineCanvasRef.current);

      return {
        x: scaleCorrected(x - canvasOffset.left, scaleFactor),
        y: scaleCorrected(y - canvasOffset.top, scaleFactor),
      };
    },
    [pipelineCanvasRef, scaleFactor, trackMouseMovement]
  );

  React.useEffect(() => {
    const handler = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", handler);
    document.addEventListener("gesturechange", handler);
    document.addEventListener("gestureend", handler);
    return () => {
      document.removeEventListener("gesturestart", handler);
      document.removeEventListener("gesturechange", handler);
      document.removeEventListener("gestureend", handler);
    };
  }, []);

  const zoom = React.useCallback(
    (mousePosition: Position, scaleDiff: number) => {
      if (disabled) return;

      const { x, y } = getPositionRelativeToCanvas(mousePosition);
      // set origin at scroll wheel trigger
      if (x !== pipelineOrigin[0] || y !== pipelineOrigin[1]) {
        pipelineSetHolderOrigin([x, y]);
      }

      setScaleFactor((current) => current + scaleDiff);
    },
    [
      disabled,
      setScaleFactor,
      pipelineOrigin,
      getPositionRelativeToCanvas,
      pipelineSetHolderOrigin,
    ]
  );

  useGesture(
    {
      onWheel: ({
        pinching,
        first,
        wheeling,
        delta: [deltaX, deltaY],
        event,
      }) => {
        if (disabled || pinching || !wheeling) return;

        // mouse wheel
        // Weird behavior: `!isTouchpad(event)` is true whenever the pinching direction changes
        // Exclude it when `first` is true.
        if (!first && !isTouchpad(event)) {
          zoom({ x: event.clientX, y: event.clientY }, -deltaY / 2048);
          return;
        }

        // Touchpad: panning
        setPipelineCanvasState((current) => ({
          pipelineOffset: [
            current.pipelineOffset[0] - deltaX,
            current.pipelineOffset[1] - deltaY,
          ],
        }));
      },
      onPinch: ({ pinching, delta: [delta], event, velocity: [velocity] }) => {
        if (disabled || !pinching) return;
        // `delta` value jumps from time to time (i.e. super big or super small).
        // We limit its range to ensure consistent zooming speed.
        const { clientX, clientY } = event as WheelEvent;
        zoom(
          { x: clientX, y: clientY },
          Math.min(Math.max(velocity, 0.02), 0.06) * (delta < 0 ? -1 : 1)
        );
      },
    },
    {
      target: ref,
      preventDefault: true,
      eventOptions: { passive: false, capture: true },
    }
  );

  return zoom;
};
